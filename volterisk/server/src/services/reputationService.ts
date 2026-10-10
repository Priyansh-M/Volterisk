import { GameError } from "../game/errors.js";
import { RULES, progressionPhase, titleForLevel, vaultModSlotsForLevel, weaponModSlotsForLevel } from "../game/rules.js";
import { CRAFT_RECIPES } from "../game/workshopEconomy.js";
import { prisma } from "../prisma.js";
import { chargeSpend, creditEarn, type Tx } from "./economyService.js";
import { writeNotification } from "./notificationService.js";

type Owned = { catalogId: string; level: number };

type Cond = (typeof RULES.REPUTATION)[number]["conditions"][number];

type ProgressCtx = {
  owned: Owned[];
  hasJob: boolean;
  cash: number;
  vaultBalance: number;
  vaultTier: string;
  vaultLevel: number;
  /** Successful heists since last reputation claim (resets each level). */
  heists: number;
  contracts: number;
  sectors: number;
  bestWeaponLevel: number;
  crafted: Record<string, number>;
  /** Lifetime non-heist credits (assets, vault mins, crafts, …). */
  credits: Set<string>;
};

/** Stable key for lifetime credit. Heists are never credited. */
export function reputationConditionKey(condition: Cond): string | null {
  if (condition.kind === "heists") return null;
  switch (condition.kind) {
    case "asset":
      return `asset:${condition.id}:${condition.minLevel ?? 1}`;
    case "cash":
      return `cash:${condition.min ?? 0}`;
    case "vault":
      return `vault:${condition.min ?? 0}`;
    case "vaultTier":
      return `vaultTier:${condition.tier ?? "standard"}:${condition.minLevel ?? 1}`;
    case "contracts":
      return `contracts:${condition.min ?? 0}`;
    case "territory":
      return `territory:${condition.min ?? 0}`;
    case "weaponLevel":
      return `weaponLevel:${condition.minLevel ?? 1}`;
    case "craft":
      return `craft:${condition.id}:${condition.min ?? 1}`;
    case "passive":
      return "passive";
    default:
      return `${condition.kind}:${condition.id ?? condition.tier ?? "x"}`;
  }
}

function liveMet(condition: Cond, ctx: ProgressCtx): boolean {
  switch (condition.kind) {
    case "passive":
      return ctx.hasJob;
    case "asset": {
      const row = ctx.owned.find((item) => item.catalogId === condition.id);
      return Boolean(row && row.level >= (condition.minLevel ?? 1));
    }
    case "cash":
      return ctx.cash >= (condition.min ?? 0);
    case "vault":
      return ctx.vaultBalance >= (condition.min ?? 0);
    case "vaultTier": {
      const order = RULES.VAULT_TIERS as readonly string[];
      const needTier = condition.tier ?? "standard";
      const haveIdx = order.indexOf(ctx.vaultTier);
      const needIdx = order.indexOf(needTier);
      if (haveIdx < 0 || needIdx < 0 || haveIdx < needIdx) return false;
      if (haveIdx > needIdx) return true;
      return ctx.vaultLevel >= (condition.minLevel ?? 1);
    }
    case "heists":
      return ctx.heists >= (condition.min ?? 0);
    case "contracts":
      return ctx.contracts >= (condition.min ?? 0);
    case "territory":
      return ctx.sectors >= (condition.min ?? 0);
    case "weaponLevel":
      return ctx.bestWeaponLevel >= (condition.minLevel ?? 1);
    case "craft":
      return (ctx.crafted[condition.id ?? ""] ?? 0) >= (condition.min ?? 1);
    default:
      return false;
  }
}

function conditionMet(condition: Cond, ctx: ProgressCtx): boolean {
  if (condition.kind === "heists") return liveMet(condition, ctx);
  const key = reputationConditionKey(condition);
  if (key && ctx.credits.has(key)) return true;
  return liveMet(condition, ctx);
}

async function craftedByMod(userId: string, client: Tx | typeof prisma = prisma): Promise<Record<string, number>> {
  const ledger = await client.craftLedger.findMany({
    where: { userId },
    select: { modId: true, count: true },
  });
  const out: Record<string, number> = {};
  for (const row of ledger) {
    if (row.count > 0) out[row.modId] = row.count;
  }

  const jobs = await client.craftingJob.findMany({
    where: { userId, collectedAt: { not: null } },
    select: { recipeId: true },
  });
  const fromJobs: Record<string, number> = {};
  for (const job of jobs) {
    const recipe = CRAFT_RECIPES.find((r) => r.id === job.recipeId);
    if (!recipe) continue;
    fromJobs[recipe.modId] = (fromJobs[recipe.modId] ?? 0) + 1;
  }

  for (const [modId, count] of Object.entries(fromJobs)) {
    if ((out[modId] ?? 0) < count) out[modId] = count;
  }

  if (Object.keys(fromJobs).length > 0) {
    const now = new Date();
    for (const [modId, count] of Object.entries(fromJobs)) {
      const have = ledger.find((r) => r.modId === modId)?.count ?? 0;
      if (have >= count) continue;
      await client.craftLedger.upsert({
        where: { userId_modId: { userId, modId } },
        create: { userId, modId, count, firstAt: now, lastAt: now },
        update: { count, lastAt: now },
      });
    }
  }

  return out;
}

async function loadCredits(userId: string, client: Tx | typeof prisma = prisma): Promise<Set<string>> {
  const rows = await client.reputationCredit.findMany({
    where: { userId },
    select: { key: true },
  });
  return new Set(rows.map((r) => r.key));
}

/** Persist any currently live non-heist conditions so they stay ticked forever. */
async function creditLiveConditions(
  userId: string,
  conditions: Cond[],
  ctx: ProgressCtx,
  client: Tx | typeof prisma = prisma,
) {
  for (const condition of conditions) {
    if (condition.kind === "heists") continue;
    if (!liveMet(condition, ctx)) continue;
    const key = reputationConditionKey(condition);
    if (!key || ctx.credits.has(key)) continue;
    try {
      await client.reputationCredit.create({ data: { userId, key } });
      ctx.credits.add(key);
    } catch {
      ctx.credits.add(key);
    }
  }
}

async function loadProgress(userId: string): Promise<{
  user: { reputationLevel: number; passiveJobId: string | null; cash: number; reputationClaimedAt: Date | null };
  ctx: ProgressCtx;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reputationLevel: true, passiveJobId: true, cash: true, reputationClaimedAt: true },
  });
  if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");

  const heistWhere = {
    attackerId: userId,
    success: true as const,
    ...(user.reputationClaimedAt ? { createdAt: { gt: user.reputationClaimedAt } } : {}),
  };

  const [owned, vault, heists, contracts, base, holdings, weaponAgg, crafted, credits] = await Promise.all([
    prisma.property.findMany({ where: { userId }, select: { catalogId: true, level: true } }),
    prisma.vault.findUnique({ where: { userId }, select: { balance: true, tier: true, level: true } }),
    prisma.heist.count({ where: heistWhere }),
    prisma.contractRun.count({ where: { userId, collectedAt: { not: null } } }),
    prisma.base.findUnique({ where: { userId }, select: { id: true } }),
    prisma.territoryHolding.count({ where: { userId } }),
    prisma.userWeapon.aggregate({ where: { userId }, _max: { upgradeLevel: true } }),
    craftedByMod(userId),
    loadCredits(userId),
  ]);

  return {
    user,
    ctx: {
      owned,
      hasJob: Boolean(user.passiveJobId),
      cash: user.cash,
      vaultBalance: vault?.balance ?? 0,
      vaultTier: vault?.tier || "standard",
      vaultLevel: vault?.level ?? 1,
      heists,
      contracts,
      sectors: (base ? 1 : 0) + holdings,
      bestWeaponLevel: weaponAgg._max.upgradeLevel ?? 0,
      crafted,
      credits,
    },
  };
}

function heistLabel(min: number): string {
  return `Complete ${min} successful heists since this reputation level`;
}

export async function getReputation(userId: string) {
  const { user, ctx } = await loadProgress(userId);
  const next = RULES.REPUTATION.find((rung) => rung.level === user.reputationLevel + 1) ?? null;
  if (next) await creditLiveConditions(userId, next.conditions, ctx);

  const fee = next?.fee ?? 0;
  const conditions = (next?.conditions ?? []).map((condition, index) => ({
    id: `${condition.kind}:${condition.id ?? condition.tier ?? "x"}:${index}`,
    label: condition.kind === "heists" ? heistLabel(condition.min ?? 0) : condition.label,
    met: conditionMet(condition, ctx),
  }));
  const met = conditions.filter((row) => row.met).length;
  const conditionsReady = Boolean(next) && conditions.length > 0 && met === conditions.length;
  const canPayFee = fee <= 0 || user.cash >= fee;
  return {
    level: user.reputationLevel,
    maxLevel: RULES.REPUTATION_MAX_LEVEL,
    title: titleForLevel(user.reputationLevel),
    phase: progressionPhase(user.reputationLevel),
    nextLevel: next?.level ?? null,
    nextTitle: next ? titleForLevel(next.level) : null,
    reward: next ? next.reward : null,
    fee: next ? fee : null,
    unlocks: next?.unlocks ?? [],
    milestone: Boolean(next?.milestone),
    ready: conditionsReady && canPayFee,
    conditionsReady,
    canPayFee,
    met,
    total: conditions.length,
    cash: user.cash,
    vaultModSlots: vaultModSlotsForLevel(user.reputationLevel),
    weaponModSlots: weaponModSlotsForLevel(user.reputationLevel),
    conditions,
  };
}

export async function claimReputation(userId: string) {
  const before = await getReputation(userId);
  if (!before.nextLevel || !before.ready || before.reward == null) {
    throw new GameError(400, "NOT_READY", "The next level is not open yet.");
  }
  const reward = before.reward;
  const fee = before.fee ?? 0;
  const nextLevel = before.nextLevel;
  const unlocks = before.unlocks ?? [];

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { reputationLevel: true, cash: true, reputationClaimedAt: true, passiveJobId: true },
    });
    if (!user || user.reputationLevel !== before.level) {
      throw new GameError(409, "ALREADY_CLAIMED", "That level is already on your file.");
    }

    const heistWhere = {
      attackerId: userId,
      success: true as const,
      ...(user.reputationClaimedAt ? { createdAt: { gt: user.reputationClaimedAt } } : {}),
    };

    const [owned, vault, heists, contracts, base, holdings, weaponAgg, crafted, credits] = await Promise.all([
      tx.property.findMany({ where: { userId }, select: { catalogId: true, level: true } }),
      tx.vault.findUnique({ where: { userId }, select: { balance: true, tier: true, level: true } }),
      tx.heist.count({ where: heistWhere }),
      tx.contractRun.count({ where: { userId, collectedAt: { not: null } } }),
      tx.base.findUnique({ where: { userId }, select: { id: true } }),
      tx.territoryHolding.count({ where: { userId } }),
      tx.userWeapon.aggregate({ where: { userId }, _max: { upgradeLevel: true } }),
      craftedByMod(userId, tx),
      loadCredits(userId, tx),
    ]);

    const ctx: ProgressCtx = {
      owned,
      hasJob: Boolean(user.passiveJobId),
      cash: user.cash,
      vaultBalance: vault?.balance ?? 0,
      vaultTier: vault?.tier || "standard",
      vaultLevel: vault?.level ?? 1,
      heists,
      contracts,
      sectors: (base ? 1 : 0) + holdings,
      bestWeaponLevel: weaponAgg._max.upgradeLevel ?? 0,
      crafted,
      credits,
    };

    const rung = RULES.REPUTATION.find((entry) => entry.level === nextLevel);
    if (!rung) throw new GameError(400, "NOT_READY", "The next level is not open yet.");
    await creditLiveConditions(userId, rung.conditions, ctx, tx);
    if (!rung.conditions.every((condition) => conditionMet(condition, ctx))) {
      throw new GameError(400, "NOT_READY", "The next level is not open yet.");
    }
    if (fee > 0) {
      if (user.cash < fee) {
        throw new GameError(400, "INSUFFICIENT_FUNDS", "Not enough cash for the level fee.");
      }
      await chargeSpend(tx, userId, fee);
      await tx.transaction.create({
        data: { type: "reputation_fee", amount: fee, fromUserId: userId },
      });
    }

    const claimedAt = new Date();
    const raised = await tx.user.updateMany({
      where: { id: userId, reputationLevel: before.level },
      data: {
        reputationLevel: nextLevel,
        reputationClaimedAt: claimedAt,
        ...(nextLevel >= RULES.TERRITORY.UNLOCK_LEVEL ? { vaultCreditCard: true } : {}),
      },
    });
    if (raised.count !== 1) {
      throw new GameError(409, "ALREADY_CLAIMED", "That level is already on your file.");
    }

    if (reward > 0) {
      await creditEarn(tx, userId, reward);
      await tx.transaction.create({
        data: { type: "reputation_reward", amount: reward, toUserId: userId },
      });
    }

    const title = titleForLevel(nextLevel);
    const unlockLine = unlocks.length ? ` Unlocks: ${unlocks.join("; ")}.` : "";
    if (nextLevel === RULES.TERRITORY.UNLOCK_LEVEL) {
      await writeNotification(tx, {
        userId,
        title: "Territory expansion unlocked",
        body: `Level ${nextLevel} (${title}) is on your file. Open the Map and scout any empty sector to expand. Hold at least $${RULES.TERRITORY.VAULT_CAPITAL_REQUIRED.toLocaleString("en-US")} in the vault. Credit card shop from vault is live.${unlockLine}`,
        severity: "INFO",
      });
      await writeNotification(tx, {
        userId,
        title: "How to expand territory",
        body: "Map → pick any empty sector → SCOUT → CLAIM on Territory. Police attention rises on expand and decays each UTC day while you keep capital compliance.",
        severity: "INFO",
      });
    } else {
      await writeNotification(tx, {
        userId,
        title: `Level ${nextLevel} · ${title}`,
        body:
          (reward > 0 ? `Level-up reward ${money(reward)} credited to cash.` : "Standing raised.") + unlockLine,
        severity: "INFO",
      });
    }
  });

  return getReputation(userId);
}

function money(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}
