import { GameError } from "../game/errors.js";
import { RULES, achievementById } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { creditCash } from "./economyService.js";

export type UnlockedAchievement = {
  id: string;
  name: string;
  description: string;
  reward: number;
};

function present(id: string): UnlockedAchievement {
  const entry = achievementById(id);
  return {
    id,
    name: entry?.name ?? id,
    description: entry?.description ?? "",
    reward: entry?.reward ?? 0,
  };
}

/**
 * Inserts any achievement the ledger now qualifies for.
 * Clean Hands treats ten collected contracts as the bar: heat is not a separate meter.
 * Redacted unlocks after REDACTED_HEIST_GOAL successful heists. The requirement stays off the client.
 */
const EQUIPMENT_SPEND = ["weapon_buy", "weapon_upgrade", "shop_buy", "camera_buy", "camera_upgrade"];

async function crossedRecently(userId: string): Promise<boolean> {
  const hits = await prisma.heist.findMany({
    where: { attackerId: userId, success: true, target: { isBot: false } },
    select: { targetId: true, createdAt: true },
  });
  if (hits.length === 0) return false;
  const windowMs = RULES.INSIDE_JOB_DAYS * 24 * 60 * 60 * 1000;
  const earliest = new Date(Math.min(...hits.map((hit) => hit.createdAt.getTime() - windowMs)));
  const latest = new Date(Math.max(...hits.map((hit) => hit.createdAt.getTime())));
  const targetIds = [...new Set(hits.map((hit) => hit.targetId))];
  const [priorHeists, priorTransfers] = await Promise.all([
    prisma.heist.findMany({
      where: {
        createdAt: { gte: earliest, lt: latest },
        OR: [
          { attackerId: userId, targetId: { in: targetIds } },
          { attackerId: { in: targetIds }, targetId: userId },
        ],
      },
      select: { attackerId: true, targetId: true, createdAt: true },
    }),
    prisma.transaction.findMany({
      where: {
        createdAt: { gte: earliest, lt: latest },
        OR: [
          { fromUserId: userId, toUserId: { in: targetIds } },
          { fromUserId: { in: targetIds }, toUserId: userId },
        ],
      },
      select: { fromUserId: true, toUserId: true, createdAt: true },
    }),
  ]);
  for (const hit of hits) {
    const since = hit.createdAt.getTime() - windowMs;
    const before = hit.createdAt.getTime();
    const prior = priorHeists.some((row) => {
      const at = row.createdAt.getTime();
      if (at < since || at >= before) return false;
      return (
        (row.attackerId === userId && row.targetId === hit.targetId) ||
        (row.attackerId === hit.targetId && row.targetId === userId)
      );
    });
    if (prior) return true;
    const crossed = priorTransfers.some((row) => {
      const at = row.createdAt.getTime();
      if (at < since || at >= before) return false;
      return (
        (row.fromUserId === userId && row.toUserId === hit.targetId) ||
        (row.fromUserId === hit.targetId && row.toUserId === userId)
      );
    });
    if (crossed) return true;
  }
  return false;
}

export async function syncAchievements(userId: string): Promise<UnlockedAchievement[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { base: true, vault: true, achievements: true },
  });
  if (!user || user.isBot) return [];

  const [contracts, heists, weaponRows, spend, ledger, longShot, inside] = await Promise.all([
    prisma.contractRun.count({ where: { userId, collectedAt: { not: null } } }),
    prisma.heist.count({ where: { attackerId: userId, success: true } }),
    prisma.userWeapon.findMany({
      where: { userId, durability: { gt: 0 } },
      select: { weaponId: true },
      distinct: ["weaponId"],
    }),
    prisma.transaction.aggregate({
      where: { fromUserId: userId, type: { in: EQUIPMENT_SPEND } },
      _sum: { amount: true },
    }),
    prisma.transaction.count({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    }),
    prisma.heist.findFirst({
      where: { attackerId: userId, success: true, successChance: { lte: RULES.AGAINST_THE_ODDS_CHANCE } },
      select: { id: true },
    }),
    crossedRecently(userId),
  ]);

  const weaponTypes = weaponRows.length;
  const owned = new Set(user.achievements.map((row) => row.achievementId));
  const due: string[] = [];
  if (contracts >= 1 && !owned.has("first-steps")) due.push("first-steps");
  if (heists >= 1 && !owned.has("first-blood")) due.push("first-blood");
  if (weaponTypes >= 5 && !owned.has("armed-and-ready")) due.push("armed-and-ready");
  if (weaponTypes >= 10 && !owned.has("growing-arsenal")) due.push("growing-arsenal");
  if (weaponTypes >= 15 && !owned.has("full-arsenal")) due.push("full-arsenal");
  if (inside && !owned.has("inside-job")) due.push("inside-job");
  if (longShot && !owned.has("against-the-odds")) due.push("against-the-odds");
  if ((spend._sum.amount ?? 0) >= RULES.BIG_SPENDER_CENTS && !owned.has("big-spender")) due.push("big-spender");
  if (ledger >= RULES.PAPER_TRAIL_COUNT && !owned.has("paper-trail")) due.push("paper-trail");
  if (user.base && !owned.has("first-entry")) due.push("first-entry");
  if (contracts >= RULES.CLEAN_HANDS_CONTRACTS && !owned.has("clean-hands")) due.push("clean-hands");
  if ((user.vault?.level ?? 0) >= 5 && !owned.has("false-bottom")) due.push("false-bottom");
  if (heists >= RULES.REDACTED_HEIST_GOAL && !owned.has("redacted")) due.push("redacted");

  const fresh: UnlockedAchievement[] = [];
  for (const achievementId of due) {
    try {
      await prisma.userAchievement.create({ data: { userId, achievementId } });
      fresh.push(present(achievementId));
    } catch {
      /* unique race: another request inserted it */
    }
  }
  return fresh;
}

export async function listAchievements(userId: string) {
  await syncAchievements(userId);
  const rows = await prisma.userAchievement.findMany({ where: { userId } });
  const byId = new Map(rows.map((row) => [row.achievementId, row]));
  return {
    achievements: RULES.ACHIEVEMENTS.map((entry) => {
      const row = byId.get(entry.id);
      return {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        reward: entry.reward,
        unlocked: Boolean(row),
        sealed: Boolean(entry.sealed) && !row,
        claimed: Boolean(row?.claimedAt),
        announced: Boolean(row?.announcedAt),
        unlockedAt: row?.unlockedAt.toISOString() ?? null,
      };
    }),
  };
}

export async function unclaimedCount(userId: string): Promise<number> {
  return prisma.userAchievement.count({ where: { userId, claimedAt: null } });
}

export async function unannouncedAchievements(userId: string) {
  const rows = await prisma.userAchievement.findMany({
    where: { userId, announcedAt: null },
    orderBy: { unlockedAt: "asc" },
  });
  return rows.map((row) => present(row.achievementId));
}

export async function acknowledgeAchievement(userId: string, achievementId: string) {
  const row = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  });
  if (!row) throw new GameError(404, "NOT_UNLOCKED", "That record is still sealed.");
  if (!row.announcedAt) {
    await prisma.userAchievement.update({ where: { id: row.id }, data: { announcedAt: new Date() } });
  }
  return { id: achievementId };
}

export async function claimAchievement(userId: string, achievementId: string) {
  const entry = achievementById(achievementId);
  if (!entry) throw new GameError(400, "UNKNOWN_ACHIEVEMENT", "No such record.");

  return prisma.$transaction(async (tx) => {
    const row = await tx.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId } },
    });
    if (!row) throw new GameError(404, "NOT_UNLOCKED", "That record is still sealed.");
    if (row.claimedAt) throw new GameError(409, "ALREADY_CLAIMED", "That reward was already collected.");
    await tx.userAchievement.update({
      where: { id: row.id },
      data: { claimedAt: new Date(), announcedAt: row.announcedAt ?? new Date() },
    });
    await creditCash(tx, userId, entry.reward);
    await tx.transaction.create({
      data: { type: "achievement_claim", amount: entry.reward, toUserId: userId },
    });
    const user = await tx.user.findUnique({ where: { id: userId } });
    return { id: entry.id, name: entry.name, reward: entry.reward, cash: user?.cash ?? 0 };
  });
}
