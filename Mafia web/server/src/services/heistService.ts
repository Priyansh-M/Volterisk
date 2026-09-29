import { randomInt } from "node:crypto";
import { GameError } from "../game/errors.js";
import { successChance } from "../game/probability.js";
import { heistStealAmount } from "../game/rewards.js";
import {
  RULES,
  effectiveWeaponLevel,
  hoursAgo,
  hoursFromNow,
  minutesAgo,
  minutesFromNow,
  wealthBucket,
} from "../game/rules.js";
import { prisma } from "../prisma.js";
import { syncAchievements, type UnlockedAchievement } from "./achievementService.js";
import { creditCash, debitVault } from "./economyService.js";
import { isStationedNpc, npcWindowStart, NPC_STATIONS, stationForUsername } from "./nightCrew.js";
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
    cooldownEndsAt: minutesFromNow(RULES.HEIST_COOLDOWN_MINUTES, heist.createdAt).toISOString(),
  };
}

export type HeistKind = "npc" | "player";

type TargetCard = {
  userId: string;
  username: string;
  vaultLevel: number;
  wealthBucket: ReturnType<typeof wealthBucket>;
  vulnerable: boolean;
  sectorId: string | null;
  regionName: string | null;
  cadence: "day" | "week" | null;
};

function assertTargetKind(target: { isBot: boolean; username: string }, kind: HeistKind): void {
  const stationed = target.isBot && isStationedNpc(target.username);
  if (kind === "npc" && !stationed) {
    throw new GameError(400, "WRONG_TARGET_KIND", "Only the stationed crews are NPC targets.");
  }
  if (kind === "player" && target.isBot) {
    throw new GameError(400, "WRONG_TARGET_KIND", "Night crews are not player targets.");
  }
}

export async function listTargets(attackerId: string) {
  const users = await prisma.user.findMany({
    where: { id: { not: attackerId } },
    include: { vault: true, base: true },
    orderBy: { username: "asc" },
  });
  const recentHits = await prisma.heist.findMany({
    where: {
      success: true,
      createdAt: { gt: hoursAgo(RULES.TARGET_PROTECTION_HOURS) },
    },
    select: { targetId: true, createdAt: true },
  });
  const protectedIds = new Set(recentHits.map((row) => row.targetId));
  const weekStart = npcWindowStart("week");
  const npcHits = await prisma.heist.findMany({
    where: { success: true, createdAt: { gt: weekStart } },
    select: { targetId: true, createdAt: true },
  });

  const cards = users
    .filter((user) => user.vault && user.vault.balance >= RULES.MIN_VAULT_BALANCE)
    .map((user) => {
      const station = stationForUsername(user.username);
      const npcLocked =
        station !== null &&
        npcHits.some(
          (hit) => hit.targetId === user.id && hit.createdAt.getTime() > npcWindowStart(station.cadence).getTime(),
        );
      return {
        isBot: user.isBot,
        card: {
          userId: user.id,
          username: user.username,
          vaultLevel: user.vault!.level,
          wealthBucket: wealthBucket(user.vault!.balance),
          vulnerable: station ? !npcLocked : !protectedIds.has(user.id),
          sectorId: user.base?.sectorId ?? null,
          regionName: user.base?.regionName ?? null,
          cadence: station?.cadence ?? null,
        } satisfies TargetCard,
      };
    });

  const stationed = new Set(NPC_STATIONS.map((station) => station.username.toLowerCase()));
  return {
    npc: cards
      .filter((row) => stationed.has(row.card.username.toLowerCase()))
      .map((row) => row.card),
    players: cards.filter((row) => !row.isBot).map((row) => row.card),
  };
}

/** Spends one Estimate Predictor and returns the chance. Does not roll. */
export async function consumeEstimate(
  attackerId: string,
  targetUserId: string,
  weaponId: string,
  kind: HeistKind,
) {
  const estimatedChance = await previewChance(attackerId, targetUserId, weaponId, kind);
  const spent = await prisma.inventoryItem.updateMany({
    where: { userId: attackerId, itemId: RULES.ESTIMATE_PREDICTOR_ID, quantity: { gte: 1 } },
    data: { quantity: { decrement: 1 } },
  });
  if (spent.count !== 1) {
    throw new GameError(400, "NO_PREDICTOR", "You do not have an Estimate Predictor.");
  }
  return { estimatedChance };
}

async function previewChance(
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
  return successChance(weaponLevel, target.vault.level, target.cameraLevel);
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

  const heist = await withSqliteRetry(() =>
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
          where: { attackerId, createdAt: { gt: minutesAgo(RULES.HEIST_COOLDOWN_MINUTES, now) } },
          orderBy: { createdAt: "desc" },
        });
        if (recentAttempt) {
          throw new GameError(409, "COOLDOWN", "You are still cooling off from the last job.", {
            cooldownEndsAt: minutesFromNow(RULES.HEIST_COOLDOWN_MINUTES, recentAttempt.createdAt).toISOString(),
          });
        }

        if (target.vault.balance < RULES.MIN_VAULT_BALANCE) {
          throw new GameError(409, "NOT_VULNERABLE", "That vault is too thin to hit.");
        }

        if (kind === "npc") {
          const station = stationForUsername(target.username);
          if (!station) {
            throw new GameError(400, "WRONG_TARGET_KIND", "Only the stationed crews are NPC targets.");
          }
          const since = npcWindowStart(station.cadence, now);
          const already = await tx.heist.findFirst({
            where: { targetId: targetUserId, success: true, createdAt: { gt: since } },
          });
          if (already) {
            throw new GameError(409, "TARGET_PROTECTED", "That crew has already been robbed this window.", {
              protectionEndsAt: null,
            });
          }
        } else {
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
        }

        const vaultLevel = target.vault.level;
        const chance = successChance(weaponLevel, vaultLevel, target.cameraLevel);
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
          if (!target.isBot) {
            await writeNotification(tx, {
              userId: targetUserId,
              heistId: heist.id,
              title: "Heist Attempted",
              body: JSON.stringify({ by: attacker.username, success: false, amountStolen: null }),
              severity: "WARNING",
            });
          }
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
        if (!target.isBot) {
          await writeNotification(tx, {
            userId: targetUserId,
            heistId: heist.id,
            title: "Heist Attempted",
            body: JSON.stringify({ by: attacker.username, success: true, amountStolen: amount }),
            severity: "CRITICAL",
          });
        }
        return presentHeist(heist, target.username, owned.weapon.name);
      },
      { timeout: 15_000 },
    ),
  );
  const unlocked: UnlockedAchievement[] = await syncAchievements(attackerId);
  return { ...heist, unlocked };
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
