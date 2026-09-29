import { ACHIEVEMENTS, type AchievementSnapshot, achievementById } from "../game/achievements.js";
import { prisma } from "../prisma.js";
import { writeNotification } from "./notificationService.js";

/** Counters are read from the ledger, never from the request body. */
async function snapshot(userId: string): Promise<AchievementSnapshot> {
  const [user, wins, failed, contracts, properties, weapons] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { vault: true, base: true },
    }),
    prisma.heist.aggregate({
      where: { attackerId: userId, success: true },
      _count: true,
      _max: { amountStolen: true },
    }),
    prisma.heist.count({ where: { attackerId: userId, success: false } }),
    prisma.contractRun.count({ where: { userId, collectedAt: { not: null } } }),
    prisma.property.count({ where: { userId } }),
    prisma.userWeapon.count({ where: { userId } }),
  ]);

  return {
    successfulHeists: wins._count,
    failedHeists: failed,
    largestHeist: wins._max.amountStolen ?? 0,
    vaultLevel: user?.vault?.level ?? 0,
    hasBase: Boolean(user?.base),
    contractsCompleted: contracts,
    properties,
    weapons,
    netWorth: (user?.cash ?? 0) + (user?.vault?.balance ?? 0),
  };
}

/**
 * Award anything newly earned. Safe to call after any gameplay event and safe
 * to call twice: the unique index on (userId, achievementId) settles ties.
 */
export async function evaluateAchievements(userId: string): Promise<string[]> {
  const [state, existing] = await Promise.all([
    snapshot(userId),
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);
  const held = new Set(existing.map((row) => row.achievementId));
  const earned = ACHIEVEMENTS.filter((entry) => !held.has(entry.id) && entry.earned(state));
  if (earned.length === 0) return [];

  const created: string[] = [];
  for (const entry of earned) {
    try {
      await prisma.userAchievement.create({
        data: { userId, achievementId: entry.id },
      });
      created.push(entry.id);
    } catch {
      // Another request already awarded it. Nothing to do.
    }
  }

  for (const id of created) {
    const definition = achievementById(id);
    if (!definition) continue;
    await writeNotification(prisma, {
      userId,
      title: `Achievement unlocked: ${definition.name}`,
      body: definition.description,
      severity: "INFO",
    });
  }
  return created;
}

export async function listAchievements(userId: string) {
  await evaluateAchievements(userId);
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "desc" },
  });
  const unlockedAt = new Map(rows.map((row) => [row.achievementId, row.unlockedAt]));

  const unlocked = ACHIEVEMENTS.filter((entry) => unlockedAt.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      unlockedAt: unlockedAt.get(entry.id)!.toISOString(),
    }))
    .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));

  const locked = ACHIEVEMENTS.filter((entry) => !entry.secret && !unlockedAt.has(entry.id)).map(
    (entry) => ({ id: entry.id, name: entry.name, description: entry.description }),
  );

  const secret = ACHIEVEMENTS.filter((entry) => entry.secret && !unlockedAt.has(entry.id)).map(
    (entry) => ({ id: entry.id, hint: entry.hint ?? "Some jobs are their own reward." }),
  );

  return { unlocked, locked, secret, recent: unlocked.slice(0, 3) };
}
