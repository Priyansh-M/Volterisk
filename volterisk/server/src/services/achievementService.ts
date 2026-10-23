import { GameError } from "../game/errors.js";
import { unpackPolice, policePoints } from "../game/policeMath.js";
import { RULES, achievementById } from "../game/rules.js";
import { CRAFT_RECIPES } from "../game/workshopEconomy.js";
import { prisma } from "../prisma.js";
import { creditEarn } from "./economyService.js";

export type UnlockedAchievement = {
  id: string;
  name: string;
  description: string;
  reward: number;
};

function wrongDoor(rows: { success: boolean }[]): boolean {
  let fails = 0;
  for (const row of [...rows].reverse()) {
    if (!row.success) fails += 1;
    else {
      if (fails >= 5) return true;
      fails = 0;
    }
  }
  return false;
}

/** Fruit, Sevens, and Vault each paid during the current UTC money day. */
function houseEdgeToday(raw: string | null): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const parts = (raw ?? "").split("|");
  if (parts[0] !== day) return false;
  return (Number(parts[6]) || 0) === 7;
}

function hotHandToday(raw: string | null): boolean {
  const noon = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const parts = (raw ?? "").split("|");
  if (parts[3] !== noon) return false;
  return (Number(parts[7]) || 0) >= 3;
}

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
 *
 * Elite activities (materials guide, excluding daily property yields):
 * - Work contracts collected at $50,000+ base reward
 * - Successful heists with take ≥ $30,000
 * - Territory holdings (L11+ expansion)
 * - Diamond vault (late-game vault play)
 */
const EQUIPMENT_SPEND = ["weapon_buy", "weapon_upgrade", "shop_buy", "camera_buy", "camera_upgrade"];

/** Count discrete elite activities for ELITE - I / ELITIST. */
async function countEliteActivities(userId: string, vaultTier: string | null | undefined): Promise<number> {
  const [hardJobs, bigHeists, holdings] = await Promise.all([
    prisma.contractRun.count({
      where: {
        userId,
        collectedAt: { not: null },
        reward: { gte: RULES.ELITE_WORK_REWARD_MIN },
      },
    }),
    prisma.heist.count({
      where: {
        attackerId: userId,
        success: true,
        amountStolen: { gte: RULES.ELITE_HEIST_TAKE_MIN },
      },
    }),
    prisma.territoryHolding.count({ where: { userId } }),
  ]);
  const diamond = (vaultTier ?? "").toLowerCase() === "diamond" ? 1 : 0;
  return hardJobs + bigHeists + holdings + diamond;
}

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

  const owned = new Set(user.achievements.map((row) => row.achievementId));
  const [contracts, heists, weaponRows, spend, ledger, longShot, inside, crafts, installedMods, eliteCount, craftedRecipes, recentHeists, soldListings, boughtListings, insurancePaid, sectors, maxedWeapons, bountyPaid, vaultRoutes] =
    await Promise.all([
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
        where: {
          attackerId: userId,
          success: true,
          successChance: { lt: RULES.AGAINST_THE_ODDS_CHANCE },
        },
        select: { id: true },
      }),
      crossedRecently(userId),
      prisma.craftingJob.count({ where: { userId, collectedAt: { not: null } } }),
      prisma.modOwned.count({ where: { userId, status: "installed" } }),
      countEliteActivities(userId, user.vault?.tier),
      prisma.craftingJob.findMany({
        where: { userId, collectedAt: { not: null } },
        select: { recipeId: true },
        distinct: ["recipeId"],
      }),
      owned.has("wrong-door")
        ? Promise.resolve([] as { success: boolean }[])
        : prisma.heist.findMany({
            where: { attackerId: userId },
            orderBy: { createdAt: "desc" },
            take: 12,
            select: { success: true },
          }),
      owned.has("fenced") ? Promise.resolve(0) : prisma.marketListing.count({ where: { sellerId: userId, status: "sold" } }),
      owned.has("fenced") ? Promise.resolve(0) : prisma.marketListing.count({ where: { buyerId: userId, status: "sold" } }),
      owned.has("insured")
        ? Promise.resolve(0)
        : prisma.transaction.count({
            where: { fromUserId: userId, type: { in: ["insurance_premium", "insurance_premium_card"] } },
          }),
      owned.has("block") ? Promise.resolve(0) : prisma.territoryHolding.count({ where: { userId } }),
      owned.has("full-floor")
        ? Promise.resolve(0)
        : prisma.userWeapon.count({ where: { userId, upgradeLevel: { gte: RULES.WEAPON_MAX_UPGRADE } } }),
      owned.has("collected") ? Promise.resolve(0) : prisma.bountyCut.count({ where: { userId, paid: { gt: 0 } } }),
      owned.has("six-routes") ? Promise.resolve(0) : prisma.transaction.count({ where: { toUserId: userId, type: "vault_rob" } }),
    ]);

  const weaponTypes = weaponRows.length;
  const recipeIds = new Set(CRAFT_RECIPES.map((r) => r.id));
  const craftedAll =
    craftedRecipes.length >= recipeIds.size && craftedRecipes.every((row) => recipeIds.has(row.recipeId));
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
  if (crafts >= 1 && !owned.has("first-craft")) due.push("first-craft");
  if (installedMods >= 1 && !owned.has("first-mod")) due.push("first-mod");
  if (contracts >= RULES.CLEAN_HANDS_CONTRACTS && !owned.has("clean-hands")) due.push("clean-hands");
  if ((user.vault?.level ?? 0) >= 5 && !owned.has("false-bottom")) due.push("false-bottom");
  if (heists >= RULES.REDACTED_HEIST_GOAL && !owned.has("redacted")) due.push("redacted");
  if (eliteCount >= 1 && !owned.has("elite-i")) due.push("elite-i");
  if (eliteCount >= RULES.ELITE_ACTIVITY_GOAL && !owned.has("elitist")) due.push("elitist");
  if (user.reputationLevel >= RULES.TERRITORY.UNLOCK_LEVEL && !owned.has("next-stage")) due.push("next-stage");
  if (user.reputationLevel >= 20 && !owned.has("standing-20")) due.push("standing-20");
  if (user.reputationLevel >= 30 && !owned.has("standing-30")) due.push("standing-30");
  if (user.reputationLevel >= 40 && !owned.has("standing-40")) due.push("standing-40");
  if (user.reputationLevel >= 50 && !owned.has("standing-50")) due.push("standing-50");
  if (craftedAll && !owned.has("elite-crafter")) due.push("elite-crafter");
  if (wrongDoor(recentHeists) && !owned.has("wrong-door")) due.push("wrong-door");
  const policeMark = unpackPolice(user.policeSettledOn);
  const policeNow = policePoints(user.policeAttention, user.policeSettledOn);
  const criticalAt = RULES.TERRITORY.POLICE_BANDS[2]?.under ?? 85;
  if ((policeNow >= criticalAt || (policeMark.flags & 2) !== 0) && !owned.has("marked")) due.push("marked");
  if (soldListings >= 1 && boughtListings >= 1 && !owned.has("fenced")) due.push("fenced");
  if ((policeMark.flags & 1) !== 0 && !owned.has("quiet-week")) due.push("quiet-week");
  if (insurancePaid >= 1 && !owned.has("insured")) due.push("insured");
  if ((user.vault?.tier ?? "").toLowerCase() === "platinum" && !owned.has("white-vault")) due.push("white-vault");
  if (houseEdgeToday(user.rouletteDay) && !owned.has("house-edge")) due.push("house-edge");
  if (sectors >= 3 && !owned.has("block")) due.push("block");
  if (bountyPaid >= 1 && !owned.has("collected")) due.push("collected");
  if (maxedWeapons >= 1 && !owned.has("full-floor")) due.push("full-floor");
  if (hotHandToday(user.rouletteDay) && !owned.has("hot-hand")) due.push("hot-hand");
  if (user.cameraLevel >= 1 && !owned.has("camera-up")) due.push("camera-up");
  if (user.avatarUrl && !owned.has("portrait")) due.push("portrait");
  if (vaultRoutes >= 6 && !owned.has("six-routes")) due.push("six-routes");

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

const ACHIEVEMENT_SECTION: Record<string, string> = {
  "first-steps": "Work",
  "clean-hands": "Work",
  "first-blood": "Heists",
  "inside-job": "Heists",
  "against-the-odds": "Heists",
  redacted: "Heists",
  "wrong-door": "Heists",
  "armed-and-ready": "Arsenal",
  "growing-arsenal": "Arsenal",
  "full-arsenal": "Arsenal",
  "full-floor": "Arsenal",
  "big-spender": "Ledger",
  "paper-trail": "Ledger",
  "first-entry": "Base",
  "first-craft": "Workshop",
  "first-mod": "Workshop",
  "elite-crafter": "Workshop",
  "false-bottom": "Vault",
  insured: "Vault",
  "white-vault": "Vault",
  "elite-i": "Elite",
  elitist: "Elite",
  "next-stage": "Standing",
  "standing-20": "Standing",
  "standing-30": "Standing",
  "standing-40": "Standing",
  "standing-50": "Standing",
  marked: "Police",
  "quiet-week": "Police",
  fenced: "Market",
  "house-edge": "Minigames",
  "hot-hand": "Minigames",
  "six-routes": "Minigames",
  block: "Territory",
  collected: "Bounties",
  "camera-up": "Profile",
  portrait: "Profile",
};

const SECTION_ORDER = [
  "Work",
  "Heists",
  "Arsenal",
  "Vault",
  "Workshop",
  "Territory",
  "Police",
  "Bounties",
  "Market",
  "Minigames",
  "Standing",
  "Elite",
  "Base",
  "Ledger",
  "Profile",
  "Other",
];

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
        description: entry.id === "redacted" && !row ? "Requirements remain classified." : entry.description,
        reward: entry.reward,
        unlocked: Boolean(row),
        sealed: Boolean(entry.sealed) && !row,
        section: ACHIEVEMENT_SECTION[entry.id] ?? "Other",
        claimed: Boolean(row?.claimedAt),
        announced: Boolean(row?.announcedAt),
        unlockedAt: row?.unlockedAt.toISOString() ?? null,
      };
    }).sort((a, b) => {
      const section = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
      return section;
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
    await creditEarn(tx, userId, entry.reward);
    await tx.transaction.create({
      data: { type: "achievement_claim", amount: entry.reward, toUserId: userId },
    });
    const user = await tx.user.findUnique({ where: { id: userId } });
    return { id: entry.id, name: entry.name, reward: entry.reward, cash: user?.cash ?? 0 };
  });
}
