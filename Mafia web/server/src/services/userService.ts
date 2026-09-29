import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { GameError } from "../game/errors.js";
import {
  RULES,
  effectiveWeaponLevel,
  hoursAgo,
  hoursFromNow,
  playerLevelFromHeists,
  weaponById,
} from "../game/rules.js";
import { prisma } from "../prisma.js";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function jwtSecret(): string {
  return process.env.JWT_SECRET || "iron-hour-local-dev";
}

export function signToken(user: { id: string; tokenVersion: number }): string {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion }, jwtSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

export async function ensureWeaponCatalog(): Promise<void> {
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

  try {
    return await prisma.user.create({
      data: {
        username,
        usernameKey,
        passwordHash,
        cash: input.cash ?? RULES.STARTING_CASH,
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
            equipped: true,
          },
        },
      },
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
    where: { attackerId: userId, createdAt: { gt: hoursAgo(RULES.HEIST_COOLDOWN_HOURS) } },
    orderBy: { createdAt: "desc" },
  });
  if (!last) return null;
  return hoursFromNow(RULES.HEIST_COOLDOWN_HOURS, last.createdAt).toISOString();
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vault: true,
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
  const equipped = user.weapons[0];
  return {
    id: user.id,
    username: user.username,
    level: playerLevelFromHeists(successfulHeists),
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
          effectiveLevel: effectiveWeaponLevel(equipped.weapon.number, equipped.upgradeLevel),
        }
      : null,
    cooldownEndsAt: await cooldownEndsAt(userId),
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
    include: { vault: true },
  });

  const richest = users
    .map((user) => ({
      username: user.username,
      netWorth: user.cash + (user.vault?.balance ?? 0),
    }))
    .sort((a, b) => b.netWorth - a.netWorth || a.username.localeCompare(b.username))
    .slice(0, 20)
    .map((row, index) => ({ rank: index + 1, ...row }));

  const grouped = await prisma.heist.groupBy({
    by: ["attackerId"],
    where: { success: true },
    _count: { _all: true },
  });
  const names = new Map(users.map((user) => [user.id, user.username]));
  const heisters = grouped
    .map((row) => ({
      username: names.get(row.attackerId) ?? "Unknown",
      successfulHeists: row._count._all,
    }))
    .sort((a, b) => b.successfulHeists - a.successfulHeists || a.username.localeCompare(b.username))
    .slice(0, 20)
    .map((row, index) => ({ rank: index + 1, ...row }));

  const biggest = await prisma.heist.findMany({
    where: { success: true },
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
