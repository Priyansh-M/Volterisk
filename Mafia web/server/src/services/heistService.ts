import { randomInt } from "node:crypto";
import { GameError } from "../game/errors.js";
import { successChance } from "../game/probability.js";
import { heistStealAmount } from "../game/rewards.js";
import {
  RULES,
  effectiveWeaponLevel,
  hoursAgo,
  hoursFromNow,
  wealthBucket,
} from "../game/rules.js";
import { prisma } from "../prisma.js";
import { creditCash, debitVault } from "./economyService.js";
import { writeNotification } from "./notificationService.js";

// Future: crew shares would split the take after a successful debit.
// Future: heat would lengthen cooldowns. Special items are not part of this ledger.

let rng: () => number = () => randomInt(1, 101);

/** Test hook. Production always uses a cryptographic 1–100 roll. */
export function setHeistRng(next: (() => number) | null): void {
  rng = next ?? (() => randomInt(1, 101));
}

function rollPercent(): number {
  const value = rng();
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new GameError(500, "BAD_ROLL", "The roll came back outside 1–100.");
  }
  return value;
}

function isBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_BUSY|database is locked/i.test(message);
}

async function withSqliteRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof GameError || !isBusy(error) || attempt === 3) throw error;
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw last;
}

function presentHeist(
  heist: {
    id: string;
    success: boolean;
    amountStolen: number;
    targetId: string;
    weaponId: string;
    weaponLevel: number;
    vaultLevel: number;
    successChance: number;
    createdAt: Date;
  },
  targetUsername: string,
  weaponName: string,
) {
  return {
    id: heist.id,
    success: heist.success,
    amountStolen: heist.amountStolen,
    targetUserId: heist.targetId,
    targetUsername,
    weaponId: heist.weaponId,
    weaponName,
    weaponLevel: heist.weaponLevel,
    vaultLevel: heist.vaultLevel,
    successChance: heist.successChance,
    cooldownEndsAt: hoursFromNow(RULES.HEIST_COOLDOWN_HOURS, heist.createdAt).toISOString(),
  };
}

export type HeistKind = "npc" | "player";

type TargetCard = {
  userId: string;
  username: string;
  vaultLevel: number;
  wealthBucket: ReturnType<typeof wealthBucket>;
  vulnerable: boolean;
};

function assertTargetKind(target: { isBot: boolean }, kind: HeistKind): void {
  if (kind === "npc" && !target.isBot) {
    throw new GameError(400, "WRONG_TARGET_KIND", "Real accounts are not on the NPC board.");
  }
  if (kind === "player" && target.isBot) {
    throw new GameError(400, "WRONG_TARGET_KIND", "Seeded crews are not player targets.");
  }
}

export async function listTargets(attackerId: string) {
  const users = await prisma.user.findMany({
    where: { id: { not: attackerId } },
    include: { vault: true },
    orderBy: { username: "asc" },
  });
  const recentHits = await prisma.heist.findMany({
    where: {
      success: true,
      createdAt: { gt: hoursAgo(RULES.TARGET_PROTECTION_HOURS) },
    },
    select: { targetId: true },
  });
  const protectedIds = new Set(recentHits.map((row) => row.targetId));

  const cards = users
    .filter((user) => user.vault && user.vault.balance >= RULES.MIN_VAULT_BALANCE)
    .map((user) => ({
      isBot: user.isBot,
      card: {
        userId: user.id,
        username: user.username,
        vaultLevel: user.vault!.level,
        wealthBucket: wealthBucket(user.vault!.balance),
        vulnerable: !protectedIds.has(user.id),
      } satisfies TargetCard,
    }));

  return {
    npc: cards.filter((row) => row.isBot).map((row) => row.card),
    players: cards.filter((row) => !row.isBot).map((row) => row.card),
  };
}

export async function previewHeist(
  attackerId: string,
  targetUserId: string,
  weaponId: string,
  kind: HeistKind,
) {
  if (attackerId === targetUserId) {
    throw new GameError(400, "SELF_TARGET", "You cannot rob your own vault.");
  }
  const owned = await prisma.userWeapon.findUnique({
    where: { userId_weaponId: { userId: attackerId, weaponId } },
    include: { weapon: true },
  });
  if (!owned) {
    throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not in your arsenal.");
  }
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { vault: true },
  });
  if (!target?.vault) {
    throw new GameError(404, "INVALID_TARGET", "No such target.");
  }
  assertTargetKind(target, kind);
  const weaponLevel = effectiveWeaponLevel(owned.weapon.number, owned.upgradeLevel);
  return { estimatedChance: successChance(weaponLevel, target.vault.level) };
}

export async function attemptHeist(
  attackerId: string,
  targetUserId: string,
  weaponId: string,
  kind: HeistKind,
) {
  if (attackerId === targetUserId) {
    throw new GameError(400, "SELF_TARGET", "You cannot rob your own vault.");
  }

  const owned = await prisma.userWeapon.findUnique({
    where: { userId_weaponId: { userId: attackerId, weaponId } },
    include: { weapon: true },
  });
  if (!owned) {
    throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not in your arsenal.");
  }
  const weaponLevel = effectiveWeaponLevel(owned.weapon.number, owned.upgradeLevel);

  return withSqliteRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const attacker = await tx.user.findUnique({ where: { id: attackerId } });
        const target = await tx.user.findUnique({
          where: { id: targetUserId },
          include: { vault: true },
        });
        if (!attacker) {
          throw new GameError(401, "UNAUTHORIZED", "Unknown player.");
        }
        if (!target?.vault) {
          throw new GameError(404, "INVALID_TARGET", "No such target.");
        }
        assertTargetKind(target, kind);

        const now = new Date();
        const recentAttempt = await tx.heist.findFirst({
          where: { attackerId, createdAt: { gt: hoursAgo(RULES.HEIST_COOLDOWN_HOURS, now) } },
          orderBy: { createdAt: "desc" },
        });
        if (recentAttempt) {
          throw new GameError(409, "COOLDOWN", "You are still cooling off from the last job.", {
            cooldownEndsAt: hoursFromNow(RULES.HEIST_COOLDOWN_HOURS, recentAttempt.createdAt).toISOString(),
          });
        }

        if (target.vault.balance < RULES.MIN_VAULT_BALANCE) {
          throw new GameError(409, "NOT_VULNERABLE", "That vault is too thin to hit.");
        }

        const recentSuccess = await tx.heist.findFirst({
          where: {
            targetId: targetUserId,
            success: true,
            createdAt: { gt: hoursAgo(RULES.TARGET_PROTECTION_HOURS, now) },
          },
        });
        if (recentSuccess) {
          throw new GameError(409, "TARGET_PROTECTED", "That vault was hit recently and is still shut.", {
            protectionEndsAt: hoursFromNow(RULES.TARGET_PROTECTION_HOURS, recentSuccess.createdAt).toISOString(),
          });
        }

        const vaultLevel = target.vault.level;
        const chance = successChance(weaponLevel, vaultLevel);
        const success = rollPercent() <= chance;

        if (!success) {
          const heist = await tx.heist.create({
            data: {
              attackerId,
              targetId: targetUserId,
              weaponId,
              weaponLevel,
              vaultLevel,
              successChance: chance,
              success: false,
              amountStolen: 0,
            },
          });
          await writeNotification(tx, {
            userId: targetUserId,
            heistId: heist.id,
            title: "Someone tried your vault",
            body: `${attacker.username} tested the door with a ${owned.weapon.name} and left with nothing.`,
            severity: "WARNING",
          });
          return presentHeist(heist, target.username, owned.weapon.name);
        }

        const amount = heistStealAmount(target.vault.balance);
        const debited = await debitVault(tx, targetUserId, amount);
        if (!debited) {
          throw new GameError(409, "VAULT_CHANGED", "The vault shifted before the take landed.");
        }
        await creditCash(tx, attackerId, amount);

        const heist = await tx.heist.create({
          data: {
            attackerId,
            targetId: targetUserId,
            weaponId,
            weaponLevel,
            vaultLevel,
            successChance: chance,
            success: true,
            amountStolen: amount,
          },
        });
        await tx.transaction.create({
          data: {
            type: "heist_payout",
            amount,
            fromUserId: targetUserId,
            toUserId: attackerId,
            heistId: heist.id,
          },
        });
        await writeNotification(tx, {
          userId: targetUserId,
          heistId: heist.id,
          title: "Your vault was hit",
          body: `${attacker.username} took $${amount.toLocaleString("en-US")} with a ${owned.weapon.name}.`,
          severity: "CRITICAL",
        });
        return presentHeist(heist, target.username, owned.weapon.name);
      },
      { timeout: 15_000 },
    ),
  );
}

export async function heistHistory(userId: string) {
  const rows = await prisma.heist.findMany({
    where: { OR: [{ attackerId: userId }, { targetId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      attacker: { select: { username: true } },
      target: { select: { username: true } },
      weapon: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    role: row.attackerId === userId ? ("attacker" as const) : ("target" as const),
    success: row.success,
    amountStolen: row.amountStolen,
    otherUsername: row.attackerId === userId ? row.target.username : row.attacker.username,
    weaponName: row.weapon.name,
    weaponLevel: row.weaponLevel,
    vaultLevel: row.vaultLevel,
    successChance: row.successChance,
    createdAt: row.createdAt.toISOString(),
  }));
}
