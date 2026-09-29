import { GameError } from "../game/errors.js";
import {
  RULES,
  exposedBalance,
  nextVaultTier,
  vaultCapacity,
  vaultDefense,
  vaultSecuredPercent,
} from "../game/rules.js";
import { prisma } from "../prisma.js";
import { creditCash, debitCash, debitVault } from "./economyService.js";

// Future: crew vaults and heat-based protection sit beside this account vault.

function presentVault(vault: {
  balance: number;
  level: number;
  tier: string;
  insured: boolean;
  insuredUntil: Date | null;
}) {
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
  return {
    balance: vault.balance,
    level,
    tier,
    tierLabel: RULES.VAULT_TIER_LABEL[tier] ?? "Standard Vault",
    defense: vaultDefense(tier, level),
    capacity: vaultCapacity(tier, level),
    securedPercent: vaultSecuredPercent(tier, level),
    exposed,
    secured: vault.balance - exposed,
    insured,
    insuredUntil: vault.insuredUntil?.toISOString() ?? null,
    maxLevel: RULES.VAULT_MAX_LEVEL,
    upgradeCost: upcoming ? upgradeCost : null,
    next: upcoming && upgradeCost != null
      ? {
          tier: upcoming,
          tierLabel: RULES.VAULT_TIER_LABEL[upcoming] ?? upcoming,
          level: nextLevel,
          defense: vaultDefense(upcoming, nextLevel),
          capacity: vaultCapacity(upcoming, nextLevel),
          converts: converting,
        }
      : null,
  };
}

export async function getVault(userId: string) {
  const vault = await prisma.vault.findUnique({ where: { userId } });
  if (!vault) throw new GameError(404, "NOT_FOUND", "Vault not found.");
  return presentVault(vault);
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
    await debitCash(tx, userId, cost);
    const updated = await tx.vault.update({
      where: { userId },
      data: converting
        ? { tier: nextTier ?? tier, level: 1 }
        : { level: { increment: 1 } },
    });
    await tx.transaction.create({
      data: {
        type: "vault_upgrade",
        amount: cost,
        fromUserId: userId,
      },
    });
    return { ...presentVault(updated), spent: cost };
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
      return presentVault(updated);
    }
    await debitCash(tx, userId, RULES.INSURANCE_PREMIUM);
    await tx.transaction.create({
      data: { type: "insurance_premium", amount: RULES.INSURANCE_PREMIUM, fromUserId: userId },
    });
    const updated = await tx.vault.update({
      where: { userId },
      data: {
        insured: true,
        insuredUntil: new Date(Date.now() + RULES.INSURANCE_HOURS * 60 * 60 * 1000),
      },
    });
    return presentVault(updated);
  });
}

export async function withdrawVault(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const debited = await debitVault(tx, userId, amount);
    if (!debited) {
      throw new GameError(400, "INSUFFICIENT_FUNDS", "The vault does not hold that much.");
    }
    await creditCash(tx, userId, amount);
    await tx.transaction.create({
      data: {
        type: "vault_withdraw",
        amount,
        fromUserId: userId,
        toUserId: userId,
      },
    });
    const vault = await tx.vault.findUnique({ where: { userId } });
    const user = await tx.user.findUnique({ where: { id: userId } });
    return { balance: vault?.balance ?? 0, cash: user?.cash ?? 0, amount };
  });
}
