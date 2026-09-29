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
import { prisma } from "../prisma.js";
import { recordStarterGrant, onboardingStateFrom } from "./onboardingService.js";
import { settlePassivePay } from "./workService.js";
import { publicProfileFor } from "./publicProfileService.js";

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

export async function ensureWeaponCatalog(): Promise<void> {
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
  for (const weapon of RULES.WEAPONS) {
    await prisma.weapon.upsert({
      where: { id: weapon.id },
      update: { name: weapon.name, number: weapon.number },
      create: { id: weapon.id, name: weapon.name, number: weapon.number },
    });
  }
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
  const profile = await getProfile(user.id);
  return { token, user: profile };
}

export async function loginPlayer(username: string, password: string) {
  const usernameKey = username.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { usernameKey } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    throw new GameError(401, "BAD_CREDENTIALS", "Wrong username or password.");
  }
  const token = signToken(user);
  const profile = await getProfile(user.id);
  return { token, user: profile };
}

export async function logoutPlayer(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

async function cooldownEndsAt(userId: string): Promise<string | null> {
  const last = await prisma.heist.findFirst({
    where: { attackerId: userId, createdAt: { gt: minutesAgo(RULES.HEIST_COOLDOWN_MINUTES) } },
    orderBy: { createdAt: "desc" },
  });
  if (!last) return null;
  return minutesFromNow(RULES.HEIST_COOLDOWN_MINUTES, last.createdAt).toISOString();
}

export async function getProfile(userId: string) {
  await settlePassivePay(userId);
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

  const [won, failed, lost] = await Promise.all([
    prisma.heist.aggregate({
      where: { attackerId: userId, success: true },
      _sum: { amountStolen: true },
      _count: true,
    }),
    prisma.heist.count({ where: { attackerId: userId, success: false } }),
    prisma.heist.aggregate({
      where: { targetId: userId, success: true },
      _sum: { amountStolen: true },
    }),
  ]);

  const successfulHeists = won._count;
  const level = user.reputationLevel;
  const equipped = user.weapons[0];
  const standing = await publicProfileFor(userId);
  return {
    id: user.id,
    username: user.username,
    level,
    title: titleForLevel(level),
    rank: standing?.rank ?? 1,
    cash: user.cash,
    vault: {
      balance: user.vault.balance,
      level: user.vault.level,
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
    currentJob: user.passiveJobId
      ? {
          id: user.passiveJobId,
          name: RULES.PASSIVE_JOBS.find((job) => job.id === user.passiveJobId)?.name ?? user.passiveJobId,
          payPerDay: RULES.PASSIVE_JOBS.find((job) => job.id === user.passiveJobId)?.payPerDay ?? 0,
        }
      : null,
    cooldownEndsAt: await cooldownEndsAt(userId),
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
      totalStolen: won._sum.amountStolen ?? 0,
      totalLost: lost._sum.amountStolen ?? 0,
    },
  };
}

export async function getLeaderboard() {
  const users = await prisma.user.findMany({
    where: { isBot: false },
    include: { vault: true, base: true },
  });
  if (users.length === 0) {
    return { richest: [], heisters: [], largestHeists: [] };
  }
  const realIds = users.map((user) => user.id);

  const grouped = await prisma.heist.groupBy({
    by: ["attackerId"],
    where: { success: true, attackerId: { in: realIds } },
    _count: { _all: true },
  });
  const wins = new Map(grouped.map((row) => [row.attackerId, row._count._all]));
  const richest = users
    .map((user) => ({
      username: user.username,
      netWorth: user.cash + (user.vault?.balance ?? 0),
      level: user.reputationLevel,
      successfulHeists: wins.get(user.id) ?? 0,
      base: user.base?.regionName ?? null,
    }))
    .sort((a, b) => b.netWorth - a.netWorth || a.username.localeCompare(b.username))
    .slice(0, 20)
    .map((row, index) => ({ rank: index + 1, ...row }));

  const names = new Map(users.map((user) => [user.id, user.username]));
  const heisters = grouped
    .flatMap((row) => {
      const username = names.get(row.attackerId);
      if (!username) return [];
      return [{ username, successfulHeists: row._count._all }];
    })
    .sort((a, b) => b.successfulHeists - a.successfulHeists || a.username.localeCompare(b.username))
    .slice(0, 20)
    .map((row, index) => ({ rank: index + 1, ...row }));

  const biggest = await prisma.heist.findMany({
    where: { success: true, attackerId: { in: realIds } },
    orderBy: [{ amountStolen: "desc" }, { createdAt: "asc" }],
    take: 20,
    include: {
      attacker: { select: { username: true } },
      target: { select: { username: true } },
    },
  });

  return {
    richest,
    heisters,
    largestHeists: biggest.map((row, index) => ({
      rank: index + 1,
      attackerUsername: row.attacker.username,
      targetUsername: row.target.username,
      amount: row.amountStolen,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
