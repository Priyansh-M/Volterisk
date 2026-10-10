import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { writeNotification } from "./notificationService.js";

const vaultYieldFreshUntil = new Map<string, number>();

/** Diamond vault compound yield since last settle. Called from profile load. */
export async function settleVaultYield(userId: string): Promise<{ credited: number } | null> {
  const nowMs = Date.now();
  if ((vaultYieldFreshUntil.get(userId) ?? 0) > nowMs) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vault: true },
  });
  if (!user?.vault) return null;
  if (user.vault.tier !== RULES.TERRITORY.VAULT_YIELD_REQUIRES_TIER) {
    vaultYieldFreshUntil.set(userId, nowMs + 3_600_000);
    return null;
  }
  if (user.reputationLevel < RULES.TERRITORY.UNLOCK_LEVEL) {
    vaultYieldFreshUntil.set(userId, nowMs + 3_600_000);
    return null;
  }

  const now = new Date(nowMs);
  const last = user.lastVaultYieldAt ?? user.createdAt;
  const hours = Math.floor((now.getTime() - last.getTime()) / 3_600_000);
  if (hours < 1) {
    const nextHour = last.getTime() + 3_600_000;
    vaultYieldFreshUntil.set(userId, Math.min(nextHour, nowMs + 3_600_000));
    return null;
  }

  const rate = RULES.TERRITORY.VAULT_YIELD_PCT_PER_HOUR / 100;
  const balance = user.vault.balance;
  if (balance <= 0) {
    await prisma.user.update({ where: { id: userId }, data: { lastVaultYieldAt: now } });
    return null;
  }

  let credited = 0;
  let running = balance;
  for (let i = 0; i < hours; i++) {
    const tick = Math.floor(running * rate);
    if (tick <= 0) break;
    credited += tick;
    running += tick;
  }
  if (credited <= 0) {
    await prisma.user.update({ where: { id: userId }, data: { lastVaultYieldAt: now } });
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.vault.update({
      where: { userId },
      data: { balance: { increment: credited } },
    });
    await tx.user.update({ where: { id: userId }, data: { lastVaultYieldAt: now } });
    await tx.transaction.create({
      data: { type: "vault_yield", amount: credited, toUserId: userId },
    });
    await writeNotification(tx, {
      userId,
      title: "Diamond vault return",
      body: `$${credited.toLocaleString("en-US")} interest credited to the vault (${hours}h at ~${RULES.TERRITORY.VAULT_YIELD_PCT_PER_HOUR}%/hr).`,
      severity: "INFO",
    });
  });
  vaultYieldFreshUntil.set(userId, nowMs + 3_600_000);
  return { credited };
}

/**
 * Daily 12:15 GMT sweep for all diamond L11+ vaults.
 * Safe to call on interval; skips players already settled past today's noon slot.
 */
export async function settleVaultYieldNoonGmt(): Promise<number> {
  const now = new Date();
  const noon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, RULES.TERRITORY.VAULT_YIELD_NOON_MINUTE, 0));
  if (now.getTime() < noon.getTime()) return 0;

  const players = await prisma.user.findMany({
    where: {
      reputationLevel: { gte: RULES.TERRITORY.UNLOCK_LEVEL },
      vault: { tier: RULES.TERRITORY.VAULT_YIELD_REQUIRES_TIER },
      OR: [{ lastVaultYieldAt: null }, { lastVaultYieldAt: { lt: noon } }],
    },
    select: { id: true },
    take: 200,
  });
  let n = 0;
  for (const row of players) {
    const result = await settleVaultYield(row.id);
    if (result?.credited) n += 1;
  }
  return n;
}
