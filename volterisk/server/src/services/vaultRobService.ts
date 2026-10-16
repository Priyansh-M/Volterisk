import { prisma } from "../prisma.js";
import { GameError } from "../game/errors.js";
import { creditCash } from "./economyService.js";
import hardPaths from "../game/vaultRobPaths.json" with { type: "json" };
import normalPaths from "../game/vaultRobPathsNormal.json" with { type: "json" };

const HARD = hardPaths as number[][][];
const NORMAL = normalPaths as number[][][];
const CHANCES = 4;
const PRIZE = 2_500;

type RobRow = { day: string | null; used: number; path: number | null; started: number };

function windowKey(now = new Date()): string {
  return new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function read(userId: string): Promise<RobRow> {
  const rows = await prisma.$queryRaw<RobRow[]>`
    SELECT "vaultRobDay" AS day, "vaultRobUsed" AS used, "vaultRobPath" AS path, "vaultRobStep" AS started
    FROM "User" WHERE id = ${userId}
  `;
  const user = rows[0];
  if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
  return user;
}

async function row(userId: string) {
  const user = await read(userId);
  const day = windowKey();
  if (user.day !== day) {
    await prisma.$executeRaw`
      UPDATE "User"
      SET "vaultRobDay" = ${day}, "vaultRobUsed" = 0, "vaultRobPath" = NULL, "vaultRobStep" = 0
      WHERE id = ${userId}
    `;
    return { day, used: 0, path: null as number | null, started: 0 };
  }
  return { day, used: Number(user.used), path: user.path == null ? null : Number(user.path), started: Number(user.started) };
}

export async function vaultRobStatus(userId: string) {
  const current = await row(userId);
  if (current.path != null) {
    await prisma.$executeRaw`
      UPDATE "User" SET "vaultRobPath" = NULL, "vaultRobStep" = 0 WHERE id = ${userId}
    `;
    return { chancesLeft: Math.max(0, CHANCES - current.used), paidUsed: Math.min(CHANCES, current.used), forfeited: true };
  }
  return { chancesLeft: Math.max(0, CHANCES - current.used), paidUsed: Math.min(CHANCES, current.used), forfeited: false };
}

function routeAt(index: number) {
  if (index >= 100) return NORMAL[index - 100];
  return HARD[index];
}

export async function vaultRobStart(userId: string, mode: "normal" | "hard") {
  const current = await row(userId);
  if (current.path != null) throw new GameError(409, "RUN_OPEN", "A run is already open.");
  const book = mode === "normal" ? NORMAL : HARD;
  const index = Math.floor(Math.random() * book.length) + (mode === "normal" ? 100 : 0);
  const started = Math.floor(Date.now() / 1000);
  const used = current.used + 1;
  await prisma.$executeRaw`
    UPDATE "User"
    SET "vaultRobDay" = ${current.day}, "vaultRobUsed" = ${used}, "vaultRobPath" = ${index}, "vaultRobStep" = ${started}
    WHERE id = ${userId}
  `;
  return {
    path: routeAt(index),
    grid: mode === "normal" ? 10 : 15,
    chancesLeft: Math.max(0, CHANCES - used),
    paidUsed: Math.min(CHANCES, used),
    pays: used <= CHANCES,
  };
}

export async function vaultRobForfeit(userId: string) {
  await prisma.$executeRaw`
    UPDATE "User" SET "vaultRobPath" = NULL, "vaultRobStep" = 0
    WHERE id = ${userId} AND "vaultRobPath" IS NOT NULL
  `;
  return { ok: true };
}

export async function vaultRobFinish(userId: string, steps: number[][]) {
  const current = await row(userId);
  if (current.path == null) throw new GameError(400, "NO_RUN", "That chance is already gone.");
  const route = routeAt(current.path);
  if (!route) throw new GameError(400, "NO_RUN", "That chance is already gone.");
  if (Math.floor(Date.now() / 1000) - current.started < 4) {
    throw new GameError(400, "TOO_FAST", "The route was still on screen.");
  }
  const expected = route.slice(1);
  const same =
    steps.length === expected.length &&
    steps.every((cell, i) => cell[0] === expected[i]![0] && cell[1] === expected[i]![1]);
  if (!same) {
    await prisma.$executeRaw`UPDATE "User" SET "vaultRobPath" = NULL, "vaultRobStep" = 0 WHERE id = ${userId}`;
    return { ok: false, cash: null as number | null };
  }
  const cash = await prisma.$transaction(async (tx) => {
    const still = await tx.$queryRaw<RobRow[]>`
      SELECT "vaultRobDay" AS day, "vaultRobUsed" AS used, "vaultRobPath" AS path, "vaultRobStep" AS started
      FROM "User" WHERE id = ${userId}
    `;
    if (still[0]?.path == null) throw new GameError(400, "NO_RUN", "That chance is already gone.");
    const pays = Number(still[0]?.used ?? 99) <= CHANCES;
    if (pays) {
      await creditCash(tx, userId, PRIZE);
      await tx.transaction.create({ data: { type: "vault_rob", amount: PRIZE, toUserId: userId } });
    }
    await tx.$executeRaw`UPDATE "User" SET "vaultRobPath" = NULL, "vaultRobStep" = 0 WHERE id = ${userId}`;
    const pocket = await tx.user.findUnique({ where: { id: userId }, select: { cash: true } });
    return pocket?.cash ?? PRIZE;
  });
  return { ok: true, cash };
}
