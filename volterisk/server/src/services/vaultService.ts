import { GameError } from "../game/errors.js";
import {
  RULES,
  exposedBalance,
  insurancePremium,
  nextVaultTier,
  vaultCapacity,
  vaultCapacityUnlimited,
  vaultDefense,
  vaultModSlotsForLevel,
  vaultSecuredPercent,
} from "../game/rules.js";
import { prisma } from "../prisma.js";
import { chargeSpend, creditCash, debitCash, debitVault } from "./economyService.js";

// Future: crew vaults and heat-based protection sit beside this account vault.

async function presentVault(
  vault: {
    balance: number;
    level: number;
    tier: string;
    insured: boolean;
    insuredUntil: Date | null;
    breached?: boolean;
  },
  userId: string,
) {
  const tier = vault.tier || "standard";
  const level = Math.min(Math.max(vault.level, 1), RULES.VAULT_MAX_LEVEL);
  const converting = level >= RULES.VAULT_MAX_LEVEL;
  const upcoming = converting ? nextVaultTier(tier) : tier;
  const upgradeCost = converting
    ? (RULES.VAULT_CONVERSION_COSTS[tier] ?? null)
    : (RULES.VAULT_LEVEL_COSTS[tier]?.[level] ?? null);
  const nextLevel = converting ? 1 : level + 1;
  const exposed = exposedBalance(vault.balance, tier, level);
  const insured =
    vault.insured && vault.insuredUntil !== null && vault.insuredUntil.getTime() > Date.now();
  const [rep, modSlotsUsed] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { reputationLevel: true, vaultCreditCard: true },
    }),
    prisma.modOwned.count({ where: { userId, kind: "vault", status: "installed" } }).catch(() => 0),
  ]);
  const creditCard = Boolean(rep?.vaultCreditCard);
  const unlimited = vaultCapacityUnlimited(tier, level, creditCard);
  const modSlots = vaultModSlotsForLevel(rep?.reputationLevel ?? 1);
  const nextUnlimited =
    upcoming != null && upgradeCost != null
      ? vaultCapacityUnlimited(upcoming, nextLevel, creditCard)
      : false;
  return {
    balance: vault.balance,
    level,
    tier,
    tierLabel: RULES.VAULT_TIER_LABEL[tier] ?? "Standard Vault",
    defense: vaultDefense(tier, level),
    capacity: unlimited ? null : vaultCapacity(tier, level),
    capacityUnlimited: unlimited,
    creditCard,
    withdrawEnabled: !creditCard,
    securedPercent: vaultSecuredPercent(tier, level),
    exposed,
    secured: vault.balance - exposed,
    insured,
    insurancePremium: insurancePremium(tier),
    breached: Boolean(vault.breached) && !insured,
    insuredUntil: vault.insuredUntil?.toISOString() ?? null,
    maxLevel: RULES.VAULT_MAX_LEVEL,
    modSlots,
    modSlotsUsed,
    upgradeCost: upcoming ? upgradeCost : null,
    next:
      upcoming && upgradeCost != null
        ? {
            tier: upcoming,
            tierLabel: RULES.VAULT_TIER_LABEL[upcoming] ?? upcoming,
            level: nextLevel,
            defense: vaultDefense(upcoming, nextLevel),
            capacity: nextUnlimited ? null : vaultCapacity(upcoming, nextLevel),
            capacityUnlimited: nextUnlimited,
            converts: converting,
          }
        : null,
  };
}

export async function getVault(userId: string) {
  const vault = await prisma.vault.findUnique({ where: { userId } });
  if (!vault) throw new GameError(404, "NOT_FOUND", "Vault not found.");
  return presentVault(vault, userId);
}

export async function upgradeVault(userId: string) {
  return prisma.$transaction(async (tx) => {
    const vault = await tx.vault.findUnique({ where: { userId } });
    if (!vault) throw new GameError(404, "NOT_FOUND", "Vault not found.");
    const tier = vault.tier || "standard";
    const level = Math.min(Math.max(vault.level, 1), RULES.VAULT_MAX_LEVEL);
    const converting = level >= RULES.VAULT_MAX_LEVEL;
    const nextTier = converting ? nextVaultTier(tier) : null;
    if (converting && !nextTier) {
      throw new GameError(400, "MAX_LEVEL", "This vault is already at the top floor.");
    }
    const cost = converting
      ? RULES.VAULT_CONVERSION_COSTS[tier]
      : RULES.VAULT_LEVEL_COSTS[tier]?.[level];
    if (!cost) throw new GameError(400, "MAX_LEVEL", "No further upgrade is priced.");
    const paidFrom = await chargeSpend(tx, userId, cost);
    const updated = await tx.vault.update({
      where: { userId },
      data: converting
        ? { tier: nextTier ?? tier, level: 1 }
        : { level: { increment: 1 } },
    });
    await tx.transaction.create({
      data: {
        type: paidFrom === "card" ? "vault_upgrade_card" : "vault_upgrade",
        amount: cost,
        fromUserId: userId,
      },
    });
    return { ...(await presentVault(updated, userId)), spent: cost, paidFrom };
  });
}

export async function setInsurance(userId: string, enabled: boolean) {
  return prisma.$transaction(async (tx) => {
    const vault = await tx.vault.findUnique({ where: { userId } });
    if (!vault) throw new GameError(404, "NOT_FOUND", "Vault not found.");
    if (!enabled) {
      const updated = await tx.vault.update({
        where: { userId },
        data: { insured: false, insuredUntil: null },
      });
      return presentVault(updated, userId);
    }
    const premium = insurancePremium(vault.tier || "standard");
    const paidFrom = await chargeSpend(tx, userId, premium);
    await tx.transaction.create({
      data: {
        type: paidFrom === "card" ? "insurance_premium_card" : "insurance_premium",
        amount: premium,
        fromUserId: userId,
      },
    });
    const updated = await tx.vault.update({
      where: { userId },
      data: {
        insured: true,
        insuredUntil: new Date(Date.now() + RULES.INSURANCE_HOURS * 60 * 60 * 1000),
        breached: false,
      },
    });
    return presentVault(updated, userId);
  });
}

export async function depositVault(userId: string, amount: number | "all") {
  return prisma.$transaction(async (tx) => {
    const vault = await tx.vault.findUnique({ where: { userId } });
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!vault || !user) throw new GameError(404, "NOT_FOUND", "Vault not found.");
    const unlimited = vaultCapacityUnlimited(vault.tier || "standard", vault.level, user.vaultCreditCard);
    const room = unlimited
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, vaultCapacity(vault.tier || "standard", vault.level) - vault.balance);
    const requested = amount === "all" ? user.cash : amount;
    const moved = Math.min(requested, room, user.cash);
    if (moved <= 0) {
      throw new GameError(
        400,
        "VAULT_FULL",
        unlimited ? "No pocket cash to deposit." : "The vault cannot take any more cash.",
      );
    }
    await debitCash(tx, userId, moved);
    await tx.vault.update({ where: { userId }, data: { balance: { increment: moved } } });
    await tx.transaction.create({
      data: { type: "vault_deposit", amount: moved, fromUserId: userId, toUserId: userId },
    });
    const freshVault = await tx.vault.findUnique({ where: { userId } });
    const freshUser = await tx.user.findUnique({ where: { id: userId } });
    return { balance: freshVault?.balance ?? 0, cash: freshUser?.cash ?? 0, amount: moved };
  });
}

export async function withdrawVault(userId: string, amount: number | "all") {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { vaultCreditCard: true },
    });
    if (user?.vaultCreditCard) {
      throw new GameError(
        400,
        "CARD_ONLY",
        "Withdrawals are closed after Level 11. Spend with your card from the vault.",
      );
    }
    const vaultRow = await tx.vault.findUnique({ where: { userId } });
    const moving = amount === "all" ? (vaultRow?.balance ?? 0) : amount;
    if (moving <= 0) throw new GameError(400, "INSUFFICIENT_FUNDS", "The vault is empty.");
    const debited = await debitVault(tx, userId, moving);
    if (!debited) {
      throw new GameError(400, "INSUFFICIENT_FUNDS", "The vault does not hold that much.");
    }
    await creditCash(tx, userId, moving);
    await tx.transaction.create({
      data: {
        type: "vault_withdraw",
        amount: moving,
        fromUserId: userId,
        toUserId: userId,
      },
    });
    const vault = await tx.vault.findUnique({ where: { userId } });
    const fresh = await tx.user.findUnique({ where: { id: userId } });
    return { balance: vault?.balance ?? 0, cash: fresh?.cash ?? 0, amount: moving };
  });
}
