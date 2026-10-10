import type { ContractRun } from "@prisma/client";
import { GameError } from "../game/errors.js";
import {
  RULES,
  minutesAgo,
  minutesFromNow,
  workContractById,
  workDifficulty,
  workRequirementLabel,
} from "../game/rules.js";
import { prisma } from "../prisma.js";
import { creditEarn } from "./economyService.js";
import { coolHeat } from "./heatService.js";
import { ASSETS, assetById } from "./propertyService.js";
import { writeNotification } from "./notificationService.js";
import { uniqueConflictText, withSqliteRetry } from "./sqlite.js";
import { careerBonuses } from "./careerService.js";
import { creditItem } from "./inventoryService.js";
import { territoryPassives } from "./territoryPassives.js";

const PAYOUT_TYPE = "contract_payout";

function mix(seed: number): number {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type WorkContract = (typeof RULES.WORK_CONTRACTS)[number];

const BOARD_MS = RULES.WORK_BOARD_ROTATION_MINUTES * 60 * 1000;
const BOARD_LEAD_MS = 30 * 60 * 1000;

function shuffleContracts(bucket: number): WorkContract[] {
  const pool = RULES.WORK_CONTRACTS;
  const secret = process.env.JWT_SECRET || "iron-hour-local-dev";
  let seed = hashSeed(`${secret}:work:${bucket}`);
  const next = () => {
    seed = mix(seed + 0x9e3779b9);
    return seed / 4294967296;
  };
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const swap = order[i]!;
    order[i] = order[j]!;
    order[j] = swap;
  }
  return order.slice(0, Math.min(RULES.WORK_BOARD_SIZE, order.length));
}

let liveBoard: { startsAt: number; contracts: WorkContract[] } | null = null;
let nextBoard: { startsAt: number; contracts: WorkContract[] } | null = null;

/** Same seven jobs for every player. The next hour is drawn during the half hour before it starts. */
function offeredContracts(now: Date) {
  const startsAt = Math.floor(now.getTime() / BOARD_MS) * BOARD_MS;
  if (!liveBoard || liveBoard.startsAt !== startsAt) {
    liveBoard = nextBoard?.startsAt === startsAt ? nextBoard : { startsAt, contracts: shuffleContracts(startsAt / BOARD_MS) };
    nextBoard = null;
  }
  const nextStart = startsAt + BOARD_MS;
  if (now.getTime() >= nextStart - BOARD_LEAD_MS && nextBoard?.startsAt !== nextStart) {
    nextBoard = { startsAt: nextStart, contracts: shuffleContracts(nextStart / BOARD_MS) };
  }
  return liveBoard.contracts;
}

async function playerLevel(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { reputationLevel: true } });
  return user?.reputationLevel ?? 1;
}

function gearLabel(requires: { id: string; minLevel: number }[] | undefined): string {
  if (!requires?.length) return "";
  return requires
    .map((req) => `${assetById(req.id)?.name ?? req.id} level ${req.minLevel}+`)
    .join(", ");
}

function gearMet(owned: { catalogId: string; level: number }[], requires: { id: string; minLevel: number }[] | undefined): boolean {
  if (!requires?.length) return true;
  return requires.every((req) => owned.some((row) => row.catalogId === req.id && row.level >= req.minLevel));
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
  const owned = await prisma.property.findMany({ where: { userId }, select: { catalogId: true, level: true } });
  const buffs = await territoryPassives(userId);
  const cooldownMins = Math.max(0, RULES.WORK_CONTRACT_COOLDOWN_MINUTES - buffs.workCooldownCutMinutes);
  const offered = offeredContracts(now);
  const [active, collected] = await Promise.all([
    prisma.contractRun.findUnique({ where: { activeSlot: userId } }),
    prisma.contractRun.findMany({
      where: { userId, collectedAt: { gt: minutesAgo(cooldownMins || 1, now) } },
      select: { contractId: true, collectedAt: true },
    }),
  ]);
  await notifyIfReady(active);

  const cooldownUntil = new Map<string, Date>();
  for (const run of collected) {
    if (!run.collectedAt) continue;
    const ends = minutesFromNow(cooldownMins, run.collectedAt);
    if (ends.getTime() <= now.getTime()) continue;
    const previous = cooldownUntil.get(run.contractId);
    if (!previous || ends > previous) cooldownUntil.set(run.contractId, ends);
  }
  return {
    active: active ? presentActive(active, now) : null,
    nextAcceptAt: null,
    contracts: offered.map((contract) => {
      const cooldownEnds = cooldownUntil.get(contract.id) ?? null;
      const levelLocked = level < contract.minLevel;
      const readyGear = gearMet(owned, contract.requires);
      const locked = levelLocked || !readyGear;
      const gear = gearLabel(contract.requires);
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
        requirement: gear ? `${workRequirementLabel(contract)}. ${gear}` : workRequirementLabel(contract),
        gearReady: readyGear,
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

  const buffs = await territoryPassives(userId);
  const cooldownMins = Math.max(0, RULES.WORK_CONTRACT_COOLDOWN_MINUTES - buffs.workCooldownCutMinutes);

  const active = await withSqliteRetry(() =>
    prisma.$transaction(async (tx) => {
      const now = new Date();
      const standing = await tx.user.findUnique({ where: { id: userId }, select: { reputationLevel: true } });
      const level = standing?.reputationLevel ?? 1;
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
      if (definition.requires?.length) {
        const ownedGear = await tx.property.findMany({ where: { userId }, select: { catalogId: true, level: true } });
        if (!gearMet(ownedGear, definition.requires)) {
          throw new GameError(403, "PROPERTY_REQUIRED", `That job needs ${gearLabel(definition.requires)}.`);
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
          collectedAt: { gt: minutesAgo(cooldownMins || 1, now) },
        },
        orderBy: { collectedAt: "desc" },
      });
      if (cooling?.collectedAt) {
        throw new GameError(409, "CONTRACT_COOLDOWN", "That contract is still cooling down.", {
          cooldownEndsAt: minutesFromNow(cooldownMins, cooling.collectedAt).toISOString(),
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
  const [buffs, career] = await Promise.all([territoryPassives(userId), careerBonuses(userId)]);
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
      const bonusPct = buffs.collectBonusPercent + career.workCollectBonusPercent;
      const bonus = Math.floor((active.reward * bonusPct) / 100);
      const payout = active.reward + bonus;
      await creditEarn(tx, userId, payout);
      await coolHeat(tx, userId, RULES.HEAT_ACTIVE_WORK);
      await tx.transaction.create({
        data: {
          type: PAYOUT_TYPE,
          amount: payout,
          toUserId: userId,
        },
      });
      const definition = workContractById(active.contractId);
      const matDrop =
        active.reward >= 50_000
          ? { id: "mat:conductive-filament", n: 1 }
          : active.reward >= 15_000
            ? { id: "mat:reinforced-alloy", n: 2 }
            : { id: "mat:scrap-components", n: 3 };
      await creditItem(tx, userId, matDrop.id, matDrop.n);
      let blueprint: string | null = null;
      if (active.reward >= 18_000 && Math.random() < 0.12) {
        const advanced = [
          "phase-alignment-core",
          "predictive-breach-module",
          "self-calibrating-assembly",
          "overdrive-mechanism",
          "aegis-defence-core",
          "predictive-security-matrix",
          "distributed-barrier-network",
          "blacksite-containment-system",
        ];
        blueprint = `bp:${advanced[Math.floor(Math.random() * advanced.length)]}`;
        await creditItem(tx, userId, blueprint, 1);
      }
      await writeNotification(tx, {
        userId,
        title: "Contract paid",
        body: `${definition?.name ?? "A contract"} paid $${payout.toLocaleString("en-US")}${bonus ? ` (incl. +$${bonus.toLocaleString("en-US")} financial)` : ""}. Materials +${matDrop.n}${blueprint ? ` · blueprint found` : ""}.`,
        severity: "INFO",
      });
      const user = await tx.user.findUnique({ where: { id: userId } });
      return {
        cash: user?.cash ?? 0,
        reward: payout,
        contractId: active.contractId,
        collectedAt: now.toISOString(),
        materials: { [matDrop.id]: matDrop.n },
        blueprint,
      };
    }),
  );
  return paid;
}

const VEHICLE_IDS = new Set<string>(ASSETS.filter((item) => item.kind === "vehicle").map((item) => item.id));

function passiveRequirement(job: (typeof RULES.PASSIVE_JOBS)[number]): string {
  const parts = [`Reputation level ${job.minReputation}`];
  for (const req of job.requires) {
    if (req.anyVehicle) {
      parts.push(`Vehicle level ${req.minLevel} or higher`);
      continue;
    }
    const name = assetById(req.id ?? "")?.name ?? req.id;
    parts.push(`${name} level ${req.minLevel} or higher`);
  }
  return parts.join(", ");
}

function passiveQualified(
  owned: { catalogId: string; level: number }[],
  job: (typeof RULES.PASSIVE_JOBS)[number],
  reputationLevel: number,
) {
  if (reputationLevel < job.minReputation) return false;
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

const passiveFresh = new Map<string, number>();

export async function settlePassivePay(userId: string): Promise<number> {
  const noon = latestPaydayNoon();
  if ((passiveFresh.get(userId) ?? 0) >= noon.getTime()) return 0;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isBot || !user.passiveJobId) return 0;
  const job = RULES.PASSIVE_JOBS.find((entry) => entry.id === user.passiveJobId);
  if (!job) return 0;
  if (user.passivePaidFor && user.passivePaidFor.getTime() >= noon.getTime()) {
    passiveFresh.set(userId, noon.getTime());
    return 0;
  }
  const owned = await prisma.property.findMany({ where: { userId }, select: { catalogId: true, level: true } });
  if (!passiveQualified(owned, job, user.reputationLevel)) return 0;
  const [buffs, career] = await Promise.all([territoryPassives(userId), careerBonuses(userId)]);
  let covered = false;
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({ where: { id: userId } });
    if (!fresh?.passiveJobId || fresh.passiveJobId !== job.id) return;
    if (fresh.passivePaidFor && fresh.passivePaidFor.getTime() >= noon.getTime()) {
      covered = true;
      return;
    }
    const bonus = Math.floor((job.payPerDay * (buffs.collectBonusPercent + career.workCollectBonusPercent)) / 100);
    const payout = job.payPerDay + bonus;
    await creditEarn(tx, userId, payout);
    await coolHeat(tx, userId, RULES.HEAT_PASSIVE_DAY);
    await tx.user.update({ where: { id: userId }, data: { passivePaidFor: noon } });
    await tx.transaction.create({
      data: { type: "passive_payday", amount: payout, toUserId: userId },
    });
    await writeNotification(tx, {
      userId,
      title: "Passive payday",
      body: `${job.name} paid $${payout.toLocaleString("en-US")} at 12:00 GMT${bonus ? ` (incl. bonuses)` : ""}.`,
      severity: "INFO",
    });
    covered = true;
  });
  if (covered) passiveFresh.set(userId, noon.getTime());
  return job.payPerDay;
}

export async function listPassiveJobs(userId: string) {
  const owned = await prisma.property.findMany({ where: { userId }, select: { catalogId: true, level: true } });
  await settlePassivePay(userId);
  const chosen = await prisma.user.findUnique({ where: { id: userId }, select: { passiveJobId: true, reputationLevel: true } });
  const reputationLevel = chosen?.reputationLevel ?? 1;
  return {
    currentJobId: chosen?.passiveJobId ?? null,
    jobs: RULES.PASSIVE_JOBS.map((job) => {
      const qualified = passiveQualified(owned, job, reputationLevel);
      return {
        id: job.id,
        name: job.name,
        payPerDay: job.payPerDay,
        requirement: passiveRequirement(job),
        qualified,
        selected: chosen?.passiveJobId === job.id,
      };
    }),
  };
}

export async function selectPassiveJob(userId: string, jobId: string) {
  const job = RULES.PASSIVE_JOBS.find((entry) => entry.id === jobId);
  if (!job) throw new GameError(400, "UNKNOWN_CONTRACT", "That passive job is not on the board.");
  const standing = await prisma.user.findUnique({ where: { id: userId }, select: { reputationLevel: true } });
  const owned = await prisma.property.findMany({ where: { userId }, select: { catalogId: true, level: true } });
  if (!passiveQualified(owned, job, standing?.reputationLevel ?? 1)) {
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
