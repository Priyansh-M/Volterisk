import { randomInt } from "node:crypto";
import { GameError } from "../game/errors.js";
import { successChance } from "../game/probability.js";
import { heistStealAmount } from "../game/rewards.js";
import {
  RULES,
  attackPower,
  exposedBalance,
  hoursAgo,
  hoursFromNow,
  minutesAgo,
  minutesFromNow,
  vaultCapacity,
  vaultDefense,
  wealthBandLabel,
  wealthBucket,
} from "../game/rules.js";
import { prisma } from "../prisma.js";
import { syncAchievements, type UnlockedAchievement } from "./achievementService.js";
import { creditCash, debitVault, type Tx } from "./economyService.js";
import { isNpcGated, isStationedNpc, loadNpcPurses, NPC_STATIONS, openNpcPurse, stationForUsername } from "./nightCrew.js";
import { gainHeat, heistHeatGain, settleHeatOnTx } from "./heatService.js";
import { writeNotification } from "./notificationService.js";

// Future: crew shares would split the take after a successful debit.
// Future: heat would lengthen cooldowns. Special items are not part of this ledger.

let rng: () => number = () => randomInt(1, 101);

/** Test hook. Production always uses a cryptographic 1–100 roll. */
export function setHeistRng(next: (() => number) | null): void {
  rng = next ?? (() => randomInt(1, 101));
}

function rollPercent(): number {
  const value = rng();
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new GameError(500, "BAD_ROLL", "The roll came back outside 1–100.");
  }
  return value;
}

function isBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_BUSY|database is locked/i.test(message);
}

async function withSqliteRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof GameError || !isBusy(error) || attempt === 3) throw error;
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw last;
}

function presentHeist(
  heist: {
    id: string;
    success: boolean;
    amountStolen: number;
    targetId: string;
    weaponId: string;
    weaponLevel: number;
    vaultLevel: number;
    successChance: number;
    createdAt: Date;
  },
  targetUsername: string,
  weaponName: string,
) {
  return {
    id: heist.id,
    success: heist.success,
    amountStolen: heist.amountStolen,
    targetUserId: heist.targetId,
    targetUsername,
    weaponId: heist.weaponId,
    weaponName,
    weaponLevel: heist.weaponLevel,
    vaultLevel: heist.vaultLevel,
    successChance: heist.successChance,
    cooldownEndsAt: minutesFromNow(RULES.HEIST_COOLDOWN_MINUTES, heist.createdAt).toISOString(),
  };
}

export type HeistKind = "npc" | "player";

type TargetCard = {
  userId: string;
  username: string;
  vaultLevel: number;
  wealthBucket: ReturnType<typeof wealthBucket>;
  estimatedWealth: string;
  vulnerable: boolean;
  sectorId: string | null;
  regionName: string | null;
  locationName: string | null;
  cadence: "day" | "week" | null;
  locked: boolean;
  cooldownEndsAt: string | null;
};

function assertTargetKind(target: { isBot: boolean; username: string }, kind: HeistKind): void {
  const stationed = target.isBot && isStationedNpc(target.username);
  if (kind === "npc" && !stationed) {
    throw new GameError(400, "WRONG_TARGET_KIND", "Only the stationed crews are NPC targets.");
  }
  if (kind === "player" && target.isBot) {
    throw new GameError(400, "WRONG_TARGET_KIND", "Night crews are not player targets.");
  }
}

const targetCache = new Map<string, { at: number; npc: TargetCard[]; players: TargetCard[] }>();

export async function listTargets(attackerId: string) {
  if (process.env.VERCEL) {
    const hit = targetCache.get(attackerId);
    if (hit && Date.now() - hit.at < 10_000) return { npc: hit.npc, players: hit.players };
  }
  const board = await readTargets(attackerId);
  if (process.env.VERCEL) targetCache.set(attackerId, { at: Date.now(), ...board });
  return board;
}

async function readTargets(attackerId: string) {
  const attacker = await prisma.user.findUnique({ where: { id: attackerId }, select: { reputationLevel: true } });
  const attackerLevel = attacker?.reputationLevel ?? 1;
  const users = await prisma.user.findMany({
    where: { id: { not: attackerId } },
    include: { vault: true, base: true },
    orderBy: { username: "asc" },
  });
  const recentHits = await prisma.heist.findMany({
    where: {
      success: true,
      createdAt: { gt: hoursAgo(RULES.TARGET_PROTECTION_HOURS) },
    },
    select: { targetId: true, createdAt: true },
  });
  const protectedIds = new Set(recentHits.map((row) => row.targetId));
  const npcRecent = await prisma.heist.findMany({
    where: { attackerId, createdAt: { gt: minutesAgo(RULES.NPC_COOLDOWN_MINUTES) }, target: { isBot: true } },
    select: { targetId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const npcCool = new Map<string, Date>();
  for (const hit of npcRecent) {
    if (!npcCool.has(hit.targetId)) npcCool.set(hit.targetId, hit.createdAt);
  }

  const stationedUsers = users.filter((user) => user.vault && stationForUsername(user.username));
  const purses = await loadNpcPurses(
    attackerId,
    stationedUsers.map((user) => ({ id: user.id, username: user.username })),
    attackerLevel,
  );
  const cards = users
    .filter((user) => user.vault && (stationForUsername(user.username) || user.vault.balance >= RULES.MIN_VAULT_BALANCE))
    .map((user) => {
        const station = stationForUsername(user.username);
        const npcHitAt = station ? npcCool.get(user.id) ?? null : null;
        const purse = station ? purses.get(user.id) ?? null : null;
        const gated = station ? isNpcGated(user.username, attackerLevel) : false;
        const vaultLevel = purse?.vaultLevel ?? user.vault!.level;
        const balance = purse?.balance ?? user.vault!.balance;
        return {
          isBot: user.isBot,
          card: {
            userId: user.id,
            username: user.username,
            vaultLevel,
            wealthBucket: wealthBucket(balance),
            estimatedWealth: wealthBandLabel(balance),
            vulnerable: station
              ? !npcHitAt && !gated
              : Boolean(user.vaultExposedUntil && user.vaultExposedUntil.getTime() > Date.now()) || !protectedIds.has(user.id),
            sectorId: user.base?.sectorId ?? null,
            regionName: user.base?.regionName ?? null,
            locationName: user.base?.name?.trim() || null,
            cadence: station?.cadence ?? null,
            locked: gated,
            cooldownEndsAt: npcHitAt ? minutesFromNow(RULES.NPC_COOLDOWN_MINUTES, npcHitAt).toISOString() : null,
          } satisfies TargetCard,
        };
    });

  const stationed = new Set(NPC_STATIONS.map((station) => station.username.toLowerCase()));
  return {
    npc: cards
      .filter((row) => stationed.has(row.card.username.toLowerCase()))
      .map((row) => row.card),
    players: cards.filter((row) => !row.isBot).map((row) => row.card),
  };
}

/** Spends one Estimate Predictor and returns the chance. Does not roll. */
export async function consumeEstimate(
  attackerId: string,
  targetUserId: string,
  weaponId: string,
  kind: HeistKind,
) {
  const quote = await previewChance(attackerId, targetUserId, weaponId, kind);
  const estimatedChance = quote.estimatedChance;
  const spent = await prisma.inventoryItem.updateMany({
    where: { userId: attackerId, itemId: RULES.ESTIMATE_PREDICTOR_ID, quantity: { gte: 1 } },
    data: { quantity: { decrement: 1 } },
  });
  if (spent.count !== 1) {
    throw new GameError(400, "NO_PREDICTOR", "You do not have an Estimate Predictor.");
  }
  return { estimatedChance };
}

async function previewChance(
  attackerId: string,
  targetUserId: string,
  weaponId: string,
  kind: HeistKind,
) {
  if (attackerId === targetUserId) {
    throw new GameError(400, "SELF_TARGET", "You cannot rob your own vault.");
  }
  const owned = await pickWeapon(attackerId, weaponId);
  if (!owned) {
    throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not in your arsenal.");
  }
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { vault: true },
  });
  if (!target?.vault) {
    throw new GameError(404, "INVALID_TARGET", "No such target.");
  }
  assertTargetKind(target, kind);
  const attack = attackPower(owned.weapon.number, owned.upgradeLevel);
  const facing = await npcFacing(attackerId, { ...target, vault: target.vault }, kind);
  const defense = vaultDefense(facing.tier, facing.vaultLevel);
  return {
    estimatedChance: successChance(attack, defense, facing.camera),
    attack,
    defense,
    advantage: attack - defense,
    weaponName: owned.weapon.name,
    weaponLevel: owned.upgradeLevel,
    vaultTier: facing.tier,
    vaultLevel: facing.vaultLevel,
  };
}

async function npcFacing(
  attackerId: string,
  target: { id: string; username: string; isBot: boolean; cameraLevel: number; vault: { tier: string; level: number } },
  kind: HeistKind,
) {
  if (kind !== "npc") {
    return { tier: target.vault.tier, vaultLevel: target.vault.level, camera: target.cameraLevel, purseId: null as string | null, balance: null as number | null };
  }
  const attacker = await prisma.user.findUnique({ where: { id: attackerId }, select: { reputationLevel: true } });
  const level = attacker?.reputationLevel ?? 1;
  if (isNpcGated(target.username, level)) {
    throw new GameError(403, "LEVEL_LOCKED", "That crew is locked until you reach level 5.");
  }
  const purse = await openNpcPurse(attackerId, target.id, target.username, level);
  return { tier: "standard", vaultLevel: purse.vaultLevel, camera: 0, purseId: purse.id, balance: purse.balance };
}

async function wearWeapon(tx: Tx, instanceId: string): Promise<boolean> {
  const row = await tx.userWeapon.update({
    where: { id: instanceId },
    data: { durability: { decrement: 1 } },
  });
  if (row.durability <= 0) {
    await tx.userWeapon.delete({ where: { id: row.id } });
    return true;
  }
  return false;
}

async function pickWeapon(attackerId: string, weaponId: string, instanceId?: string) {
  if (instanceId) {
    return prisma.userWeapon.findFirst({
      where: { id: instanceId, userId: attackerId, durability: { gt: 0 } },
      include: { weapon: true },
    });
  }
  return prisma.userWeapon.findFirst({
    where: { userId: attackerId, weaponId, durability: { gt: 0 } },
    include: { weapon: true },
    orderBy: [{ equipped: "desc" }, { upgradeLevel: "desc" }],
  });
}

export async function quoteHeist(
  attackerId: string,
  targetUserId: string,
  weaponId: string,
  kind: HeistKind,
) {
  return previewChance(attackerId, targetUserId, weaponId, kind);
}

export async function attemptHeist(
  attackerId: string,
  targetUserId: string,
  weaponId: string,
  kind: HeistKind,
  instanceId?: string,
) {
  if (attackerId === targetUserId) {
    throw new GameError(400, "SELF_TARGET", "You cannot rob your own vault.");
  }

  const owned = await pickWeapon(attackerId, weaponId, instanceId);
  if (!owned) {
    throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not in your arsenal.");
  }
  const weaponLevel = owned.upgradeLevel;
  const attack = attackPower(owned.weapon.number, owned.upgradeLevel);
  const previewTarget = await prisma.user.findUnique({ where: { id: targetUserId }, include: { vault: true } });
  if (!previewTarget?.vault) throw new GameError(404, "INVALID_TARGET", "No such target.");
  assertTargetKind(previewTarget, kind);
  const facing = await npcFacing(attackerId, { ...previewTarget, vault: previewTarget.vault }, kind);

  const heist = await withSqliteRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const attacker = await tx.user.findUnique({ where: { id: attackerId } });
        const target = await tx.user.findUnique({
          where: { id: targetUserId },
          include: { vault: true },
        });
        if (!attacker) {
          throw new GameError(401, "UNAUTHORIZED", "Unknown player.");
        }
        if (!target?.vault) {
          throw new GameError(404, "INVALID_TARGET", "No such target.");
        }
        assertTargetKind(target, kind);

        const now = new Date();
        if (kind === "player") {
          const recentAttempt = await tx.heist.findFirst({
            where: { attackerId, createdAt: { gt: minutesAgo(RULES.HEIST_COOLDOWN_MINUTES, now) }, target: { isBot: false } },
            orderBy: { createdAt: "desc" },
          });
          if (recentAttempt) {
            throw new GameError(409, "COOLDOWN", "You are still cooling off from the last job.", {
              cooldownEndsAt: minutesFromNow(RULES.HEIST_COOLDOWN_MINUTES, recentAttempt.createdAt).toISOString(),
            });
          }
        }

        const purseBalance = facing.balance ?? target.vault.balance;
        if (purseBalance < RULES.MIN_VAULT_BALANCE) {
          throw new GameError(409, "NOT_VULNERABLE", "That vault is too thin to hit.");
        }

        if (kind === "npc") {
          const station = stationForUsername(target.username);
          if (!station) {
            throw new GameError(400, "WRONG_TARGET_KIND", "Only the stationed crews are NPC targets.");
          }
          const already = await tx.heist.findFirst({
            where: { attackerId, targetId: targetUserId, createdAt: { gt: minutesAgo(RULES.NPC_COOLDOWN_MINUTES, now) } },
            orderBy: { createdAt: "desc" },
          });
          if (already) {
            throw new GameError(409, "COOLDOWN", "That crew is still cooling off for you.", {
              cooldownEndsAt: minutesFromNow(RULES.NPC_COOLDOWN_MINUTES, already.createdAt).toISOString(),
            });
          }
        } else {
          const exposed = Boolean(target.vaultExposedUntil && target.vaultExposedUntil.getTime() > now.getTime());
          const recentSuccess = exposed
            ? null
            : await tx.heist.findFirst({
                where: {
                  targetId: targetUserId,
                  success: true,
                  createdAt: { gt: hoursAgo(RULES.TARGET_PROTECTION_HOURS, now) },
                },
              });
          if (recentSuccess) {
            throw new GameError(409, "TARGET_PROTECTED", "That vault was hit recently and is still shut.", {
              protectionEndsAt: hoursFromNow(RULES.TARGET_PROTECTION_HOURS, recentSuccess.createdAt).toISOString(),
            });
          }
        }

        const vaultLevel = facing.vaultLevel;
        const defense = vaultDefense(facing.tier, vaultLevel);
        const chance = successChance(attack, defense, target.cameraLevel);
        const roll = rollPercent();
        const success = roll <= chance;
        const broken = await wearWeapon(tx, owned.id);

        if (!success) {
          const exposedUntil = kind === "player" ? hoursFromNow(RULES.FAILED_HEIST_EXPOSURE_HOURS, now) : null;
          if (exposedUntil) {
            const currentExposed = attacker.vaultExposedUntil;
            await tx.user.update({
              where: { id: attackerId },
              data: {
                vaultExposedUntil:
                  currentExposed && currentExposed.getTime() > exposedUntil.getTime() ? currentExposed : exposedUntil,
              },
            });
          }
          const heist = await tx.heist.create({
            data: {
              attackerId,
              targetId: targetUserId,
              weaponId,
              weaponLevel,
              vaultLevel,
              successChance: chance,
              success: false,
              amountStolen: 0,
            },
          });
          if (!target.isBot) {
            await writeNotification(tx, {
              userId: targetUserId,
              heistId: heist.id,
              title: "Heist Attempted",
              body: JSON.stringify({ by: attacker.username, success: false, amountStolen: null }),
              severity: "WARNING",
            });
          }
          await gainHeat(tx, attackerId, heistHeatGain(false, 0));
          return {
            ...presentHeist(heist, target.username, owned.weapon.name),
            attack,
            defense,
            advantage: attack - defense,
            vaultTier: target.vault.tier,
            broken,
            penalty: exposedUntil
              ? {
                  hours: RULES.FAILED_HEIST_EXPOSURE_HOURS,
                  endsAt: exposedUntil.toISOString(),
                }
              : null,
          };
        }

        const insuredNow =
          !facing.purseId &&
          target.vault.insured &&
          target.vault.insuredUntil !== null &&
          target.vault.insuredUntil.getTime() > now.getTime();
        const openVault = !facing.purseId && target.vault.breached && !insuredNow;
        const pool = facing.balance ?? target.vault.balance;
        const exposed = openVault ? pool : exposedBalance(pool, facing.tier, vaultLevel);
        const amount = heistStealAmount(exposed);
        const debited = facing.purseId
          ? (await tx.npcPurse.updateMany({ where: { id: facing.purseId, balance: { gte: amount } }, data: { balance: { decrement: amount } } })).count === 1
          : await debitVault(tx, targetUserId, amount);
        if (!debited) {
          throw new GameError(409, "VAULT_CHANGED", "The vault shifted before the take landed.");
        }
        await settleHeatOnTx(tx, attackerId);
        await gainHeat(tx, attackerId, heistHeatGain(true, amount));
        await creditCash(tx, attackerId, amount);

        const heist = await tx.heist.create({
          data: {
            attackerId,
            targetId: targetUserId,
            weaponId,
            weaponLevel,
            vaultLevel,
            successChance: chance,
            success: true,
            amountStolen: amount,
          },
        });
        await tx.transaction.create({
          data: {
            type: "heist_payout",
            amount,
            fromUserId: targetUserId,
            toUserId: attackerId,
            heistId: heist.id,
          },
        });
        if (!facing.purseId) {
          await tx.vault.update({
            where: { userId: targetUserId },
            data: { breached: !insuredNow },
          });
        }
        if (!target.isBot) {
          await writeNotification(tx, {
            userId: targetUserId,
            heistId: heist.id,
            title: "You were robbed",
            body: JSON.stringify({ by: attacker.username, success: true, amountStolen: amount }),
            severity: "CRITICAL",
          });
        }
        const paid = await tx.user.findUnique({ where: { id: attackerId }, select: { cash: true } });
        if (
          target.vault.insured &&
          target.vault.insuredUntil &&
          target.vault.insuredUntil.getTime() > now.getTime()
        ) {
          const cover = Math.floor((amount * RULES.INSURANCE_COVERAGE_PERCENT) / 100);
          const room = Math.max(0, vaultCapacity(target.vault.tier, vaultLevel) - (target.vault.balance - amount));
          const paidCover = Math.min(cover, room);
          if (paidCover > 0) {
            await tx.vault.update({
              where: { userId: targetUserId },
              data: { balance: { increment: paidCover } },
            });
            await tx.transaction.create({
              data: { type: "insurance_payout", amount: paidCover, toUserId: targetUserId },
            });
          }
        }
        return {
          ...presentHeist(heist, target.username, owned.weapon.name),
          attack,
          defense,
          advantage: attack - defense,
          vaultTier: target.vault.tier,
          broken,
          cash: paid?.cash ?? null,
        };
      },
      { timeout: 15_000 },
    ),
  );
  const unlocked: UnlockedAchievement[] = await syncAchievements(attackerId);
  return { ...heist, unlocked };
}

export async function heistHistory(userId: string) {
  const rows = await prisma.heist.findMany({
    where: { OR: [{ attackerId: userId }, { targetId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      attacker: { select: { username: true } },
      target: { select: { username: true } },
      weapon: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    role: row.attackerId === userId ? ("attacker" as const) : ("target" as const),
    success: row.success,
    amountStolen: row.amountStolen,
    otherUsername: row.attackerId === userId ? row.target.username : row.attacker.username,
    weaponName: row.weapon.name,
    weaponLevel: row.weaponLevel,
    vaultLevel: row.vaultLevel,
    successChance: row.successChance,
    createdAt: row.createdAt.toISOString(),
  }));
}
