import { GameError } from "../game/errors.js";
import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { creditCash, debitCash, debitVault } from "./economyService.js";

// Future: crew vaults and heat-based protection sit beside this account vault.

export async function getVault(userId: string) {
  const vault = await prisma.vault.findUnique({ where: { userId } });
  if (!vault) throw new GameError(404, "NOT_FOUND", "Vault not found.");
  const upgradeCost = vault.level >= RULES.VAULT_MAX_LEVEL ? null : (RULES.VAULT_UPGRADE_COSTS[vault.level] ?? null);
  return {
    balance: vault.balance,
    level: vault.level,
    maxLevel: RULES.VAULT_MAX_LEVEL,
    upgradeCost,
  };
}

export async function upgradeVault(userId: string) {
  return prisma.$transaction(async (tx) => {
    const vault = await tx.vault.findUnique({ where: { userId } });
    if (!vault) throw new GameError(404, "NOT_FOUND", "Vault not found.");
    if (vault.level >= RULES.VAULT_MAX_LEVEL) {
      throw new GameError(400, "MAX_LEVEL", "This vault is already at the top floor.");
    }
    const cost = RULES.VAULT_UPGRADE_COSTS[vault.level];
    if (!cost) throw new GameError(400, "MAX_LEVEL", "No further upgrade is priced.");
    await debitCash(tx, userId, cost);
    const updated = await tx.vault.update({
      where: { userId },
      data: { level: { increment: 1 } },
    });
    await tx.transaction.create({
      data: {
        type: "vault_upgrade",
        amount: cost,
        fromUserId: userId,
      },
    });
    return {
      balance: updated.balance,
      level: updated.level,
      maxLevel: RULES.VAULT_MAX_LEVEL,
      upgradeCost:
        updated.level >= RULES.VAULT_MAX_LEVEL ? null : (RULES.VAULT_UPGRADE_COSTS[updated.level] ?? null),
      spent: cost,
    };
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
