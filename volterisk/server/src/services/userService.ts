import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { GameError } from "../game/errors.js";
import {
  RULES,
  attackPower,
  maxDurability,
  minutesAgo,
  minutesFromNow,
  titleForLevel,
  weaponById,
} from "../game/rules.js";
import { isDbBusyError, prisma, withDbRetry } from "../prisma.js";
import { recordStarterGrant, onboardingStateFrom } from "./onboardingService.js";
import { unclaimedCount } from "./achievementService.js";
import { settleHeatState } from "./heatService.js";
import { settlePassivePay } from "./workService.js";
import { CAREERS, isCareerId } from "../game/careersAndMods.js";
import { assetById, assetMoneySpent } from "./propertyService.js";
import { settlePropertyMaterialYields } from "./propertyMaterialYieldService.js";
import { settleVaultYield } from "./vaultYieldService.js";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function jwtSecret(): string {
  return process.env.JWT_SECRET || "iron-hour-local-dev";
}

export function signToken(user: { id: string; tokenVersion: number }): string {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion }, jwtSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

/**
 * The first five catalog ids used to be Crowbar, Lockpick, Drill, Thermal, Vault Breaker.
 * Those four later tools now sit further down the line, so existing instances move
 * before the catalog rows are renamed.
 */
const LEGACY_WEAPON_MOVES: [string, string][] = [
  ["weapon:0005", "weapon:0013"],
  ["weapon:0004", "weapon:0010"],
  ["weapon:0003", "weapon:0007"],
  ["weapon:0002", "weapon:0004"],
];

let catalogReady = false;

export async function ensureWeaponCatalog(): Promise<void> {
  if (process.env.VERCEL && catalogReady) return;
  const legacy = await prisma.weapon.findUnique({ where: { id: "weapon:0002" } });
  if (legacy?.name === "Lockpick Set") {
    const parked = await prisma.weapon.findMany();
    for (const row of parked) {
      await prisma.weapon.update({ where: { id: row.id }, data: { number: 1_000 + row.number } });
    }
    for (const [from, to] of LEGACY_WEAPON_MOVES) {
      const source = await prisma.weapon.findUnique({ where: { id: from } });
      if (!source) continue;
      await prisma.weapon.create({
        data: { id: to, name: source.name, number: 2_000 + source.number },
      });
      await prisma.userWeapon.updateMany({ where: { weaponId: from }, data: { weaponId: to } });
      await prisma.heist.updateMany({ where: { weaponId: from }, data: { weaponId: to } });
      await prisma.weapon.delete({ where: { id: from } });
    }
  }
  const rows = await prisma.weapon.findMany({ select: { id: true, name: true, number: true } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const weapon of RULES.WEAPONS) {
    const row = byId.get(weapon.id);
    if (row && row.name === weapon.name && row.number === weapon.number) continue;
    await prisma.weapon.upsert({
      where: { id: weapon.id },
      update: { name: weapon.name, number: weapon.number },
      create: { id: weapon.id, name: weapon.name, number: weapon.number },
    });
  }
  if (process.env.VERCEL) catalogReady = true;
}

export async function createPlayer(input: {
  username: string;
  password: string;
  isBot?: boolean;
  cash?: number;
  vaultBalance?: number;
  vaultLevel?: number;
}) {
  const username = input.username.trim();
  const usernameKey = username.toLowerCase();
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
  const passwordHash = await bcrypt.hash(input.password, rounds);
  const starter = weaponById(RULES.WEAPONS[0].id);
  if (!starter) {
    throw new GameError(500, "CATALOG", "Starter weapon is missing from the rules.");
  }

  const cash = input.cash ?? RULES.STARTING_CASH;
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          usernameKey,
          passwordHash,
          cash,
          isBot: input.isBot ?? false,
          vault: {
            create: {
              balance: input.vaultBalance ?? RULES.STARTING_VAULT_BALANCE,
              level: input.vaultLevel ?? RULES.STARTING_VAULT_LEVEL,
            },
          },
          weapons: {
            create: {
              weaponId: starter.id,
              upgradeLevel: RULES.WEAPON_MIN_UPGRADE,
              durability: maxDurability(starter.id, RULES.WEAPON_MIN_UPGRADE),
              maxDurability: maxDurability(starter.id, RULES.WEAPON_MIN_UPGRADE),
              equipped: true,
            },
          },
        },
      });
      await recordStarterGrant(tx, user.id, user.cash);
      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new GameError(409, "USERNAME_TAKEN", "That name is already on the ledger.");
    }
    throw error;
  }
}

export async function registerPlayer(username: string, password: string) {
  await ensureWeaponCatalog();
  const user = await createPlayer({ username, password });
  const token = signToken(user);
  const profile = await getProfile(user.id, { settle: false });
  return { token, user: profile };
}

export async function usernameAvailable(raw: string): Promise<{ available: boolean }> {
  const username = raw.trim();
  if (username.length < 3 || username.length > 24 || !NAME_RE.test(username)) {
    return { available: false };
  }
  const taken = await prisma.user.findUnique({
    where: { usernameKey: username.toLowerCase() },
    select: { id: true },
  });
  return { available: !taken };
}

export async function loginPlayer(username: string, password: string) {
  const usernameKey = username.trim().toLowerCase();
  const user = await withDbRetry(() => prisma.user.findUnique({ where: { usernameKey } }));
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    throw new GameError(401, "BAD_CREDENTIALS", "Wrong username or password.");
  }
  const token = signToken(user);
  try {
    // Light profile on login (no settles / no heist aggregates). Client uses this
    // payload to enter; /api/me fills stats in the background.
    const profile = await withDbRetry(() => getProfile(user.id, { settle: false }));
    return { token, user: profile };
  } catch (error) {
    if (error instanceof GameError) throw error;
    console.error("[login] getProfile failed after credentials ok", error);
    throw new GameError(
      503,
      "DB_BUSY",
      isDbBusyError(error)
        ? "The ledger is busy. Try again in a moment."
        : "Could not load your file. Try again in a moment.",
    );
  }
}

export async function logoutPlayer(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

async function cooldownEndsAt(userId: string): Promise<string | null> {
  const last = await prisma.heist.findFirst({
    where: { attackerId: userId, createdAt: { gt: minutesAgo(RULES.HEIST_COOLDOWN_MINUTES) }, target: { isBot: false } },
    orderBy: { createdAt: "desc" },
  });
  if (!last) return null;
  return minutesFromNow(RULES.HEIST_COOLDOWN_MINUTES, last.createdAt).toISOString();
}

export async function getProfile(userId: string, opts?: { settle?: boolean }) {
  const light = opts?.settle === false;
  // Settles are independent of the profile read. Never let them fail login/me.
  if (!light) {
    await settleHeatState(userId).catch(() => null);
    await settlePassivePay(userId).catch(() => null);
    await settleVaultYield(userId).catch(() => null);
    await settlePropertyMaterialYields(userId).catch(() => null);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vault: true,
      base: true,
      weapons: { where: { equipped: true }, include: { weapon: true } },
    },
  });
  if (!user || !user.vault) {
    throw new GameError(404, "NOT_FOUND", "Player not found.");
  }
  // Login uses light=true: one user read only. Full /api/me loads heist stats.
  // Same profile shape either way — features unchanged, login just arrives sooner.
  let successfulHeists = 0;
  let failed = 0;
  let totalStolen = 0;
  let totalLost = 0;
  let unclaimed = 0;
  let cooldown: string | null = null;
  if (!light) {
    const [won, failedCount, lost, unclaimedCountValue, cooldownValue] = await Promise.all([
      prisma.heist
        .aggregate({
          where: { attackerId: userId, success: true },
          _sum: { amountStolen: true },
          _count: true,
        })
        .catch(() => ({ _sum: { amountStolen: 0 }, _count: 0 })),
      prisma.heist.count({ where: { attackerId: userId, success: false } }).catch(() => 0),
      prisma.heist
        .aggregate({
          where: { targetId: userId, success: true },
          _sum: { amountStolen: true },
        })
        .catch(() => ({ _sum: { amountStolen: 0 } })),
      unclaimedCount(userId).catch(() => 0),
      cooldownEndsAt(userId).catch(() => null),
    ]);
    successfulHeists = won._count;
    failed = failedCount;
    totalStolen = won._sum.amountStolen ?? 0;
    totalLost = lost._sum.amountStolen ?? 0;
    unclaimed = unclaimedCountValue;
    cooldown = cooldownValue;
  }

  const level = user.reputationLevel;
  const equipped = user.weapons[0];
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    level,
    title: titleForLevel(level),
    rank: 1,
    cash: user.cash,
    vaultCreditCard: Boolean(user.vaultCreditCard),
    vault: {
      balance: user.vault.balance,
      level: user.vault.level,
      tier: user.vault.tier,
    },
    equippedWeapon: equipped
      ? {
          id: equipped.weaponId,
          name: equipped.weapon.name,
          number: equipped.weapon.number,
          upgradeLevel: equipped.upgradeLevel,
          effectiveLevel: attackPower(equipped.weapon.number, equipped.upgradeLevel),
          attack: attackPower(equipped.weapon.number, equipped.upgradeLevel),
        }
      : null,
    heat: user.heat,
    penalty:
      user.vaultExposedUntil && user.vaultExposedUntil.getTime() > Date.now()
        ? { active: true, endsAt: user.vaultExposedUntil.toISOString() }
        : { active: false, endsAt: null },
    unclaimedAchievements: unclaimed,
    currentJob: user.passiveJobId
      ? {
          id: user.passiveJobId,
          name: RULES.PASSIVE_JOBS.find((job) => job.id === user.passiveJobId)?.name ?? user.passiveJobId,
          payPerDay: RULES.PASSIVE_JOBS.find((job) => job.id === user.passiveJobId)?.payPerDay ?? 0,
        }
      : null,
    cooldownEndsAt: cooldown,
    onboarding: onboardingStateFrom(user),
    base: user.base
      ? {
          sectorId: user.base.sectorId,
          landmassId: user.base.landmassId,
          regionName: user.base.regionName,
          name: user.base.name,
        }
      : null,
    stats: {
      successfulHeists,
      failedHeists: failed,
      totalStolen,
      totalLost,
    },
  };
}

const BOARD_CACHE_MS = 45_000;

type VaultStanding = {
  rank: number;
  username: string;
  netWorth: number;
  level: number;
  successfulHeists: number;
  base: string | null;
  career: string | null;
};

type AssetStanding = {
  rank: number;
  username: string;
  assetWorth: number;
  properties: number;
  vehicles: number;
  vaultLabel: string;
};

let leaderboardCache: {
  at: number;
  richest: VaultStanding[];
  assets: AssetStanding[];
  heisters: { rank: number; username: string; successfulHeists: number }[];
  largestHeists: { rank: number; attackerUsername: string; targetUsername: string; amount: number; createdAt: string }[];
  youById: Map<string, VaultStanding>;
  assetsYouById: Map<string, AssetStanding>;
} | null = null;

export async function getLeaderboard(viewerId?: string) {
  const core = await loadLeaderboard();
  return {
    richest: core.richest,
    you: viewerId ? (core.youById.get(viewerId) ?? null) : null,
    assets: core.assets,
    assetsYou: viewerId ? (core.assetsYouById.get(viewerId) ?? null) : null,
    heisters: core.heisters,
    largestHeists: core.largestHeists,
  };
}

async function loadLeaderboard() {
  if (leaderboardCache && Date.now() - leaderboardCache.at < BOARD_CACHE_MS) {
    return leaderboardCache;
  }
  const built = await computeLeaderboard();
  leaderboardCache = { at: Date.now(), ...built };
  return leaderboardCache;
}

async function computeLeaderboard() {
  const users = await prisma.user.findMany({
    where: { isBot: false },
    include: { vault: true, base: true, properties: { select: { catalogId: true, level: true } } },
  });
  if (users.length === 0) {
    return {
      richest: [],
      assets: [],
      heisters: [],
      largestHeists: [],
      youById: new Map<string, VaultStanding>(),
      assetsYouById: new Map<string, AssetStanding>(),
    };
  }
  const realIds = users.map((user) => user.id);

  const grouped = await prisma.heist.groupBy({
    by: ["attackerId"],
    where: { success: true, attackerId: { in: realIds } },
    _count: { _all: true },
  });
  const wins = new Map(grouped.map((row) => [row.attackerId, row._count._all]));
  const ordered = users
    .map((user) => {
      const primary = isCareerId(user.primaryCareer) ? user.primaryCareer : null;
      return {
        id: user.id,
        username: user.username,
        netWorth: user.cash + (user.vault?.balance ?? 0),
        level: user.reputationLevel,
        successfulHeists: wins.get(user.id) ?? 0,
        base: user.base?.regionName ?? null,
        career: primary ? CAREERS.BONUSES[primary].label : null,
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth || a.username.localeCompare(b.username));
  let placed = 0;
  let previousWorth: number | null = null;
  const ranked = ordered.map((row, index) => {
    if (previousWorth === null || row.netWorth !== previousWorth) {
      placed = index + 1;
      previousWorth = row.netWorth;
    }
    return {
      rank: placed,
      username: row.username,
      netWorth: row.netWorth,
      level: row.level,
      successfulHeists: row.successfulHeists,
      base: row.base,
      career: row.career,
      id: row.id,
    };
  });
  const richest = ranked.filter((row) => row.rank <= RULES.LEADERBOARD_SIZE).map(({ id: _id, ...row }) => row);
  const youById = new Map<string, VaultStanding>();
  for (const row of ranked) {
    if (row.rank <= RULES.LEADERBOARD_SIZE) continue;
    const { id, ...rest } = row;
    youById.set(id, rest);
  }

  const assetOrdered = users
    .map((user) => {
      let assetWorth = 0;
      let properties = 0;
      let vehicles = 0;
      for (const owned of user.properties) {
        const item = assetById(owned.catalogId);
        if (!item) continue;
        if (item.kind === "vehicle") vehicles += 1;
        else properties += 1;
        assetWorth += assetMoneySpent(item.price, owned.level, owned.catalogId);
      }
      const tier = user.vault?.tier ?? "standard";
      const vaultLevel = user.vault?.level ?? 1;
      const vaultLabel = `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Lvl.${vaultLevel}`;
      return { id: user.id, username: user.username, assetWorth, properties, vehicles, vaultLabel };
    })
    .sort((a, b) => b.assetWorth - a.assetWorth || a.username.localeCompare(b.username));
  let assetPlace = 0;
  let previousAsset: number | null = null;
  const assetRanked = assetOrdered.map((row, index) => {
    if (previousAsset === null || row.assetWorth !== previousAsset) {
      assetPlace = index + 1;
      previousAsset = row.assetWorth;
    }
    return { rank: assetPlace, ...row };
  });
  const assets = assetRanked.filter((row) => row.rank <= RULES.LEADERBOARD_SIZE).map(({ id: _id, ...row }) => row);
  const assetsYouById = new Map<string, AssetStanding>();
  for (const row of assetRanked) {
    if (row.rank <= RULES.LEADERBOARD_SIZE) continue;
    const { id, ...rest } = row;
    assetsYouById.set(id, rest);
  }

  const names = new Map(users.map((user) => [user.id, user.username]));
  const heisters = grouped
    .flatMap((row) => {
      const username = names.get(row.attackerId);
      if (!username) return [];
      return [{ username, successfulHeists: row._count._all }];
    })
    .sort((a, b) => b.successfulHeists - a.successfulHeists || a.username.localeCompare(b.username))
    .slice(0, RULES.LEADERBOARD_SIZE)
    .map((row, index) => ({ rank: index + 1, ...row }));

  const biggest = await prisma.heist.findMany({
    where: { success: true, attackerId: { in: realIds } },
    orderBy: [{ amountStolen: "desc" }, { createdAt: "asc" }],
    take: RULES.LEADERBOARD_SIZE,
    include: {
      attacker: { select: { username: true } },
      target: { select: { username: true } },
    },
  });

  return {
    richest,
    assets,
    heisters,
    largestHeists: biggest.map((row, index) => ({
      rank: index + 1,
      attackerUsername: row.attacker.username,
      targetUsername: row.target.username,
      amount: row.amountStolen,
      createdAt: row.createdAt.toISOString(),
    })),
    youById,
    assetsYouById,
  };
}

const ICONS = new Set(["crest", "crow", "vault", "wire"]);

export async function setAvatar(userId: string, raw: string) {
  const value = raw.trim();
  let avatarUrl: string | null = null;
  if (value) {
    if (value.startsWith("icon:")) {
      const mark = value.slice(5);
      if (!ICONS.has(mark)) throw new GameError(400, "BAD_AVATAR", "That mark is not on the sheet.");
      avatarUrl = `icon:${mark}`;
    } else {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new GameError(400, "BAD_AVATAR", "Paste a direct Postimages link.");
      }
      const host = url.hostname.toLowerCase();
      if (url.protocol !== "https:" || (host !== "i.postimg.cc" && host !== "i.postimg.org")) {
        throw new GameError(400, "BAD_AVATAR", "Use a direct link from i.postimg.cc.");
      }
      if (!/\.(png|jpe?g|gif|webp)$/i.test(url.pathname)) {
        throw new GameError(400, "BAD_AVATAR", "The link should end in the picture file, like avatar.png.");
      }
      avatarUrl = url.toString();
    }
  }
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  return getProfile(userId);
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 .'_-]*$/;

export async function renamePlayer(userId: string, raw: string) {
  const username = raw.trim();
  if (username.length < 3 || username.length > 24 || !NAME_RE.test(username)) {
    throw new GameError(400, "BAD_NAME", "Use 3 to 24 letters, numbers, spaces, apostrophes, hyphens, or underscores.");
  }
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { username, usernameKey: username.toLowerCase() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new GameError(409, "USERNAME_TAKEN", "That name is already on the ledger.");
    }
    throw error;
  }
  return { username };
}

export async function deletePlayer(userId: string) {
  await prisma.$transaction(async (tx) => {
    const heists = await tx.heist.findMany({
      where: { OR: [{ attackerId: userId }, { targetId: userId }] },
      select: { id: true },
    });
    const heistIds = heists.map((row) => row.id);
    await tx.notification.deleteMany({
      where: { OR: [{ userId }, ...(heistIds.length ? [{ heistId: { in: heistIds } }] : [])] },
    });
    if (heistIds.length) {
      await tx.transaction.deleteMany({ where: { heistId: { in: heistIds } } });
    }
    await tx.transaction.deleteMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } });
    await tx.heist.deleteMany({ where: { OR: [{ attackerId: userId }, { targetId: userId }] } });
    await tx.npcPurse.deleteMany({ where: { OR: [{ attackerId: userId }, { npcId: userId }] } });
    await tx.user.delete({ where: { id: userId } });
  });
}
