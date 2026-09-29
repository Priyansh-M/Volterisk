import type { ContractRun } from "@prisma/client";
import { GameError } from "../game/errors.js";
import {
  RULES,
  minutesAgo,
  minutesFromNow,
  playerLevelFromHeists,
  workContractById,
  workDifficulty,
  workRequirementLabel,
} from "../game/rules.js";
import { prisma } from "../prisma.js";
import { creditCash } from "./economyService.js";
import { ASSETS, assetById } from "./propertyService.js";
import { writeNotification } from "./notificationService.js";
import { uniqueConflictText, withSqliteRetry } from "./sqlite.js";

const PAYOUT_TYPE = "contract_payout";

function offeredContracts(now: Date) {
  const pool = RULES.WORK_CONTRACTS;
  const windowMs = RULES.WORK_BOARD_ROTATION_MINUTES * 60 * 1000;
  const bucket = Math.floor(now.getTime() / windowMs);
  const start = bucket % pool.length;
  const count = Math.min(RULES.WORK_BOARD_SIZE, pool.length);
  return Array.from({ length: count }, (_, index) => pool[(start + index) % pool.length]);
}

async function playerLevel(userId: string): Promise<number> {
  const wins = await prisma.heist.count({ where: { attackerId: userId, success: true } });
  return playerLevelFromHeists(wins);
}

function presentActive(run: ContractRun, now: Date) {
  const definition = workContractById(run.contractId);
  return {
    id: run.id,
    contractId: run.contractId,
    name: definition?.name ?? run.contractId,
    reward: run.reward,
    risk: definition?.risk ?? "LOW",
    locationLabel: definition?.locationLabel ?? "",
    acceptedAt: run.acceptedAt.toISOString(),
    completesAt: run.completesAt.toISOString(),
    ready: run.completesAt.getTime() <= now.getTime(),
  };
}

async function notifyIfReady(run: ContractRun | null): Promise<void> {
  if (!run || run.collectedAt || run.readyNotifiedAt) return;
  if (run.completesAt.getTime() > Date.now()) return;
  const definition = workContractById(run.contractId);
  await prisma.$transaction(async (tx) => {
    const marked = await tx.contractRun.updateMany({
      where: {
        id: run.id,
        collectedAt: null,
        readyNotifiedAt: null,
        completesAt: { lte: new Date() },
      },
      data: { readyNotifiedAt: new Date() },
    });
    if (marked.count !== 1) return;
    await writeNotification(tx, {
      userId: run.userId,
      title: "Contract ready",
      body: `${definition?.name ?? "A contract"} is ready to collect.`,
      severity: "INFO",
    });
  });
}

export async function listContracts(userId: string) {
  const now = new Date();
  const level = await playerLevel(userId);
  const offered = offeredContracts(now);
  const [active, collected] = await Promise.all([
    prisma.contractRun.findUnique({ where: { activeSlot: userId } }),
    prisma.contractRun.findMany({
      where: { userId, collectedAt: { not: null } },
      orderBy: { collectedAt: "desc" },
    }),
  ]);
  await notifyIfReady(active);

  const cooldownUntil = new Map<string, Date>();
  for (const run of collected) {
    if (!run.collectedAt) continue;
    const ends = minutesFromNow(RULES.WORK_CONTRACT_COOLDOWN_MINUTES, run.collectedAt);
    if (ends.getTime() <= now.getTime()) continue;
    const previous = cooldownUntil.get(run.contractId);
    if (!previous || ends > previous) cooldownUntil.set(run.contractId, ends);
  }

  return {
    active: active ? presentActive(active, now) : null,
    contracts: offered.map((contract) => {
      const cooldownEnds = cooldownUntil.get(contract.id) ?? null;
      const locked = level < contract.minLevel;
      return {
        id: contract.id,
        name: contract.name,
        minLevel: contract.minLevel,
        durationMinutes: contract.durationMinutes,
        reward: contract.reward,
        risk: contract.risk,
        difficulty: workDifficulty(contract),
        requiresProperty: contract.requiresProperty ?? null,
        locationLabel: contract.locationLabel,
        requirement: workRequirementLabel(contract),
        locked,
        available: !locked && !cooldownEnds && !active,
        cooldownEndsAt: cooldownEnds ? cooldownEnds.toISOString() : null,
      };
    }),
  };
}

export async function acceptContract(userId: string, contractId: string) {
  const definition = workContractById(contractId);
  if (!definition) throw new GameError(400, "UNKNOWN_CONTRACT", "That contract is not on the books.");

  const active = await withSqliteRetry(() =>
    prisma.$transaction(async (tx) => {
      const now = new Date();
      const wins = await tx.heist.count({ where: { attackerId: userId, success: true } });
      const level = playerLevelFromHeists(wins);
      if (level < definition.minLevel) {
        throw new GameError(403, "LEVEL_LOCKED", `That job needs level ${definition.minLevel}.`);
      }
      if (definition.requiresProperty) {
        const property = await tx.property.findFirst({
          where: { userId, catalogId: definition.requiresProperty },
        });
        if (!property) {
          throw new GameError(403, "PROPERTY_REQUIRED", `That job needs a ${definition.requiresProperty}.`);
        }
      }
      const onBoard = offeredContracts(now).some((contract) => contract.id === definition.id);
      if (!onBoard) {
        throw new GameError(409, "NOT_OFFERED", "That contract is not on the board right now.");
      }
      const cooling = await tx.contractRun.findFirst({
        where: {
          userId,
          contractId: definition.id,
          collectedAt: { gt: minutesAgo(RULES.WORK_CONTRACT_COOLDOWN_MINUTES, now) },
        },
        orderBy: { collectedAt: "desc" },
      });
      if (cooling?.collectedAt) {
        throw new GameError(409, "CONTRACT_COOLDOWN", "That contract is still cooling down.", {
          cooldownEndsAt: minutesFromNow(
            RULES.WORK_CONTRACT_COOLDOWN_MINUTES,
            cooling.collectedAt,
          ).toISOString(),
        });
      }
      const existing = await tx.contractRun.findUnique({ where: { activeSlot: userId } });
      if (existing) {
        throw new GameError(409, "ACTIVE_CONTRACT", "Finish the contract you already have.");
      }
      try {
        return await tx.contractRun.create({
          data: {
            userId,
            contractId: definition.id,
            reward: definition.reward,
            completesAt: minutesFromNow(definition.durationMinutes, now),
            activeSlot: userId,
          },
        });
      } catch (error) {
        const hint = uniqueConflictText(error);
        if (hint?.includes("activeslot") || hint?.includes("active")) {
          throw new GameError(409, "ACTIVE_CONTRACT", "Finish the contract you already have.");
        }
        throw error;
      }
    }),
  );

  return { active: presentActive(active, new Date()) };
}

export async function collectContract(userId: string) {
  const paid = await withSqliteRetry(() =>
    prisma.$transaction(async (tx) => {
      const active = await tx.contractRun.findUnique({ where: { activeSlot: userId } });
      if (!active) {
        throw new GameError(404, "NO_CONTRACT", "Nothing on the board is waiting.");
      }
      const now = new Date();
      if (active.completesAt.getTime() > now.getTime()) {
        throw new GameError(409, "TOO_EARLY", "That job is not finished yet.", {
          completesAt: active.completesAt.toISOString(),
        });
      }
      const claimed = await tx.contractRun.updateMany({
        where: {
          id: active.id,
          activeSlot: userId,
          collectedAt: null,
          completesAt: { lte: now },
        },
        data: { collectedAt: now, activeSlot: null },
      });
      if (claimed.count !== 1) {
        throw new GameError(409, "ALREADY_COLLECTED", "That payout was already taken.");
      }
      await creditCash(tx, userId, active.reward);
      await tx.transaction.create({
        data: {
          type: PAYOUT_TYPE,
          amount: active.reward,
          toUserId: userId,
        },
      });
      const definition = workContractById(active.contractId);
      await writeNotification(tx, {
        userId,
        title: "Contract paid",
        body: `${definition?.name ?? "A contract"} paid $${active.reward.toLocaleString("en-US")}.`,
        severity: "INFO",
      });
      const user = await tx.user.findUnique({ where: { id: userId } });
      return {
        cash: user?.cash ?? 0,
        reward: active.reward,
        contractId: active.contractId,
        collectedAt: now.toISOString(),
      };
    }),
  );
  return paid;
}

const VEHICLE_IDS = new Set<string>(ASSETS.filter((item) => item.kind === "vehicle").map((item) => item.id));

function passiveRequirement(job: (typeof RULES.PASSIVE_JOBS)[number]): string {
  const parts = job.requires.map((req) => {
    if (req.anyVehicle) return `Vehicle level ${req.minLevel} or higher`;
    const name = assetById(req.id ?? "")?.name ?? req.id;
    return `${name} level ${req.minLevel} or higher`;
  });
  const needsBuilding = job.requires.some((req) => req.id && assetById(req.id)?.kind === "property");
  if (!needsBuilding) parts.unshift("No property");
  return parts.join(", ");
}

function passiveQualified(
  owned: { catalogId: string; level: number }[],
  job: (typeof RULES.PASSIVE_JOBS)[number],
) {
  return job.requires.every((req) => {
    if (req.anyVehicle) {
      return owned.some((row) => VEHICLE_IDS.has(row.catalogId) && row.level >= req.minLevel);
    }
    const row = owned.find((item) => item.catalogId === req.id);
    return Boolean(row && row.level >= req.minLevel);
  });
}


export function latestPaydayNoon(now = new Date()): Date {
  const noon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
  if (now.getTime() < noon.getTime()) noon.setUTCDate(noon.getUTCDate() - 1);
  return noon;
}

export async function settlePassivePay(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isBot || !user.passiveJobId) return 0;
  const job = RULES.PASSIVE_JOBS.find((entry) => entry.id === user.passiveJobId);
  if (!job) return 0;
  const noon = latestPaydayNoon();
  if (user.passivePaidFor && user.passivePaidFor.getTime() >= noon.getTime()) return 0;
  const owned = await prisma.property.findMany({ where: { userId }, select: { catalogId: true, level: true } });
  if (!passiveQualified(owned, job)) return 0;
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({ where: { id: userId } });
    if (!fresh?.passiveJobId || fresh.passiveJobId !== job.id) return;
    if (fresh.passivePaidFor && fresh.passivePaidFor.getTime() >= noon.getTime()) return;
    await creditCash(tx, userId, job.payPerDay);
    await tx.user.update({ where: { id: userId }, data: { passivePaidFor: noon } });
    await tx.transaction.create({
      data: { type: "passive_payday", amount: job.payPerDay, toUserId: userId },
    });
  });
  return job.payPerDay;
}

export async function settleAllPassivePay(): Promise<void> {
  const due = await prisma.user.findMany({
    where: { isBot: false, passiveJobId: { not: null } },
    select: { id: true },
  });
  for (const row of due) await settlePassivePay(row.id);
}

export async function listPassiveJobs(userId: string) {
  const owned = await prisma.property.findMany({ where: { userId }, select: { catalogId: true, level: true } });
  await settlePassivePay(userId);
  const chosen = await prisma.user.findUnique({ where: { id: userId }, select: { passiveJobId: true } });
  return {
    currentJobId: chosen?.passiveJobId ?? null,
    jobs: RULES.PASSIVE_JOBS.map((job) => {
      const qualified = passiveQualified(owned, job);
      return {
        id: job.id,
        name: job.name,
        payPerDay: job.payPerDay,
        requirement: job.requires.length === 0 ? "No requirements" : passiveRequirement(job),
        qualified,
        selected: chosen?.passiveJobId === job.id,
      };
    }),
  };
}

export async function selectPassiveJob(userId: string, jobId: string) {
  const job = RULES.PASSIVE_JOBS.find((entry) => entry.id === jobId);
  if (!job) throw new GameError(400, "UNKNOWN_CONTRACT", "That passive job is not on the board.");
  const owned = await prisma.property.findMany({ where: { userId }, select: { catalogId: true, level: true } });
  if (!passiveQualified(owned, job)) {
    throw new GameError(403, "NOT_QUALIFIED", "You do not meet that job's requirements.");
  }
  await settlePassivePay(userId);
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { passiveJobId: true, passivePaidFor: true } });
  const noon = latestPaydayNoon();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      passiveJobId: job.id,
      passivePaidFor: current?.passiveJobId === job.id ? current.passivePaidFor : noon,
    },
  });
  return { jobId: job.id, name: job.name, payPerDay: job.payPerDay, cash: updated.cash };
}
