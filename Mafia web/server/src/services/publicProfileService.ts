import { playerLevelFromHeists, titleForLevel, wealthBandLabel } from "../game/rules.js";
import { prisma } from "../prisma.js";

/**
 * One place that turns private ledgers into the public view of a player.
 * Callers get bands and ranks, never a balance, so no route can leak cash.
 */
export type PublicProfile = {
  userId: string;
  username: string;
  title: string;
  level: number;
  rank: number;
  estimatedWealth: string;
  properties: number;
  weapons: number;
  successfulHeists: number;
  failedHeists: number;
  /** Server-side only. Never put this on a response for another player. */
  netWorth: number;
};

export async function loadPublicProfiles(): Promise<Map<string, PublicProfile>> {
  const [users, heists, properties, weapons] = await Promise.all([
    prisma.user.findMany({ include: { vault: true } }),
    prisma.heist.groupBy({ by: ["attackerId", "success"], _count: { _all: true } }),
    prisma.property.groupBy({ by: ["userId"], _count: { _all: true } }),
    prisma.userWeapon.groupBy({ by: ["userId"], _count: { _all: true } }),
  ]);

  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  for (const row of heists) {
    const bucket = row.success ? wins : losses;
    bucket.set(row.attackerId, row._count._all);
  }
  const propertyCounts = new Map(properties.map((row) => [row.userId, row._count._all]));
  const weaponCounts = new Map(weapons.map((row) => [row.userId, row._count._all]));

  const ranked = users
    .filter((user) => !user.isBot)
    .map((user) => ({
      user,
      netWorth: user.cash + (user.vault?.balance ?? 0),
    }))
    .sort((a, b) => b.netWorth - a.netWorth || a.user.username.localeCompare(b.user.username));

  const index = new Map<string, PublicProfile>();
  ranked.forEach((row, position) => {
    const successfulHeists = wins.get(row.user.id) ?? 0;
    const level = playerLevelFromHeists(successfulHeists);
    index.set(row.user.id, {
      userId: row.user.id,
      username: row.user.username,
      title: titleForLevel(level),
      level,
      rank: position + 1,
      estimatedWealth: wealthBandLabel(row.netWorth),
      properties: propertyCounts.get(row.user.id) ?? 0,
      weapons: weaponCounts.get(row.user.id) ?? 0,
      successfulHeists,
      failedHeists: losses.get(row.user.id) ?? 0,
      netWorth: row.netWorth,
    });
  });
  return index;
}

export async function publicProfileFor(userId: string): Promise<PublicProfile | null> {
  const index = await loadPublicProfiles();
  return index.get(userId) ?? null;
}

/** The public shape sent to other players: no netWorth, no balances. */
export function toPublicCard(profile: PublicProfile) {
  return {
    username: profile.username,
    title: profile.title,
    level: profile.level,
    rank: profile.rank,
    estimatedWealth: profile.estimatedWealth,
    properties: profile.properties,
    weapons: profile.weapons,
    successfulHeists: profile.successfulHeists,
  };
}

/** Public dossier. Exact cash, vault, and net worth stay off this object. */
export async function publicDossier(username: string) {
  const user = await prisma.user.findUnique({
    where: { usernameKey: username.trim().toLowerCase() },
    include: { base: true },
  });
  if (!user || user.isBot) return null;
  const profile = await publicProfileFor(user.id);
  if (!profile) return null;
  return {
    ...toPublicCard(profile),
    failedHeists: profile.failedHeists,
    base: user.base
      ? {
          sectorId: user.base.sectorId,
          landmassId: user.base.landmassId,
          regionName: user.base.regionName,
        }
      : null,
  };
}
