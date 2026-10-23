import { territoryModById } from "../game/careersAndMods.js";
import { GameError } from "../game/errors.js";
import { RULES } from "../game/rules.js";
import {
  TERRITORY_CLAIM_FEES,
  TERRITORY_MAP_COLORS,
  territoryClaimFee,
  territoryMapColorById,
} from "../game/workshopEconomy.js";
import { prisma } from "../prisma.js";
import { chargeSpend, debitVault } from "./economyService.js";
import { packPolice, policePoints, unpackPolice } from "../game/policeMath.js";
import { writeNotification } from "./notificationService.js";
import { syncPoliceBounty } from "./bountyService.js";
import { vaultYieldPctPerHour } from "./vaultYieldService.js";
import { territoryPassives } from "./territoryPassives.js";

const STAGES = RULES.TERRITORY.STAGES;

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function policeBand(attention: number): string {
  for (const band of RULES.TERRITORY.POLICE_BANDS) {
    if (attention < band.under) return band.label;
  }
  return "CRITICAL";
}

function maxSectors(repLevel: number): number {
  let cap = 1;
  for (const [level, n] of Object.entries(RULES.TERRITORY.MAX_SECTORS_BY_LEVEL)) {
    if (repLevel >= Number(level)) cap = Math.max(cap, n);
  }
  return cap;
}

export const POLICE_EPOCH = Date.UTC(2026, 0, 1, 12, 0, 0, 0);
const POLICE_WINDOW_MS = 48 * 60 * 60 * 1000;

function roundPolice(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Hourly −2, and a full clear at 12:00 GMT every 48 hours. Values are display points. */
export function policeClock(attention: number, lastTick: Date | null, now = new Date()) {
  const windowStart = POLICE_EPOCH + Math.floor((now.getTime() - POLICE_EPOCH) / POLICE_WINDOW_MS) * POLICE_WINDOW_MS;
  let value = attention;
  let tick = lastTick ?? now;
  let reset = false;
  if (lastTick && lastTick.getTime() < windowStart && now.getTime() >= windowStart) {
    value = 0;
    tick = new Date(windowStart);
    reset = true;
  }
  const hours = Math.max(0, Math.floor((now.getTime() - tick.getTime()) / 3_600_000));
  if (hours > 0) {
    value = Math.max(0, value - hours * RULES.TERRITORY.POLICE_PER_HOUR);
    tick = new Date(tick.getTime() + hours * 3_600_000);
  }
  return { attention: roundPolice(value), tick, windowStart, reset };
}

const FINE = 50_000;

async function confiscateIfCritical(tx: {
  vault: { findUnique: (args: unknown) => Promise<{ balance: number } | null> };
  transaction: { create: (args: unknown) => Promise<unknown> };
}, userId: string, before: number, after: number, alreadyFinedWindow: number, windowStart: number): Promise<number> {
  if (!(before < 85 && after >= 85)) return alreadyFinedWindow;
  if (alreadyFinedWindow === windowStart) return alreadyFinedWindow;
  const vault = await tx.vault.findUnique({ where: { userId }, select: { balance: true } });
  const take = Math.min(FINE, vault?.balance ?? 0);
  if (take > 0 && (await debitVault(tx as never, userId, take))) {
    await tx.transaction.create({
      data: { type: "police_confiscate", amount: take, fromUserId: userId },
    });
    await writeNotification(tx as never, {
      userId,
      title: "Police confiscation",
      body: `THE POLICE HAVE CONFISCATED ${take.toLocaleString("en-US")} FROM YOUR VAULT`,
      severity: "CRITICAL",
    });
  }
  return windowStart;
}

export async function addPoliceAttention(
  tx: {
    user: {
      findUnique: (args: unknown) => Promise<{ policeAttention: number; policeSettledOn: string | null; reputationLevel: number } | null>;
      update: (args: unknown) => Promise<unknown>;
    };
    vault: { findUnique: (args: unknown) => Promise<{ balance: number } | null> };
    transaction: { create: (args: unknown) => Promise<unknown> };
  },
  userId: string,
  delta: number,
): Promise<{ before: number; after: number }> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { policeAttention: true, policeSettledOn: true, reputationLevel: true },
  });
  if (!user) return { before: 0, after: 0 };
  // Police attention is a level 11+ system. Below that it never moves.
  if (user.reputationLevel < RULES.TERRITORY.UNLOCK_LEVEL) return { before: 0, after: 0 };
  const packed = unpackPolice(user.policeSettledOn);
  const before = policePoints(user.policeAttention, user.policeSettledOn);
  const clock = policeClock(before, packed.tickMs ? new Date(packed.tickMs) : null);
  const after = roundPolice(Math.max(0, clock.attention + delta));
  const fined = clock.reset ? 0 : packed.finedWindow;
  const finedWindow = await confiscateIfCritical(tx, userId, clock.attention, after, fined, clock.windowStart);
  await tx.user.update({
    where: { id: userId },
    data: {
      policeAttention: Math.round(after * 10),
      policeSettledOn: packPolice(packed.day ?? utcDayKey(), clock.tick.getTime(), finedWindow),
    },
  });
  return { before: clock.attention, after };
}

/**
 * Decays police attention and runs the daily bounty tick. Level 11+ only.
 * Pass an already-loaded user to skip the read on hot paths. Returns display points.
 */
export async function settlePolice(
  userId: string,
  preloaded?: { policeAttention: number; policeSettledOn: string | null; reputationLevel: number },
): Promise<number> {
  const user =
    preloaded ??
    (await prisma.user.findUnique({
      where: { id: userId },
      select: { policeAttention: true, policeSettledOn: true, reputationLevel: true },
    }));
  if (!user) return 0;
  if (user.reputationLevel < RULES.TERRITORY.UNLOCK_LEVEL) return 0;
  const packed = unpackPolice(user.policeSettledOn);
  const points = policePoints(user.policeAttention, user.policeSettledOn);
  const clock = policeClock(points, packed.tickMs ? new Date(packed.tickMs) : null);
  const today = utcDayKey();
  const daily = packed.day !== today;
  const tenths = Math.round(clock.attention * 10);
  const finedWindow = clock.reset ? 0 : packed.finedWindow;
  if (tenths !== user.policeAttention || daily || !packed.versioned || finedWindow !== packed.finedWindow) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        policeAttention: tenths,
        policeSettledOn: packPolice(today, clock.tick.getTime(), finedWindow),
      },
    });
  }
  if (daily) await syncPoliceBounty(userId, clock.attention, packed.day != null).catch(() => null);
  return clock.attention;
}

async function assertUnlocked(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vault: true, base: true },
  });
  if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
  if (user.reputationLevel < RULES.TERRITORY.UNLOCK_LEVEL) {
    throw new GameError(403, "LOCKED", `Territory expansion opens at reputation level ${RULES.TERRITORY.UNLOCK_LEVEL}.`);
  }
  if (!user.base) throw new GameError(400, "NO_BASE", "Claim a home sector before expanding.");
  return user;
}

async function ownedSectorIds(userId: string): Promise<string[]> {
  const [base, holdings] = await Promise.all([
    prisma.base.findUnique({ where: { userId }, select: { sectorId: true } }),
    prisma.territoryHolding.findMany({ where: { userId }, select: { sectorId: true } }),
  ]);
  const ids = holdings.map((h) => h.sectorId);
  if (base) ids.unshift(base.sectorId);
  return ids;
}

async function sectorTaken(sectorId: string): Promise<boolean> {
  const [base, holding, op] = await Promise.all([
    prisma.base.findUnique({ where: { sectorId }, select: { id: true } }),
    prisma.territoryHolding.findUnique({ where: { sectorId }, select: { id: true } }),
    prisma.expansionOp.findFirst({
      where: { sectorId, closedAt: null },
      select: { id: true },
    }),
  ]);
  return Boolean(base || holding || op);
}

function specCatalog() {
  const specs = RULES.TERRITORY.SPECIALIZATIONS;
  return {
    industrial: {
      id: "industrial" as const,
      label: specs.industrial.label,
      blurb: specs.industrial.blurb,
      attackBuffPercent: specs.industrial.attackBuffPercent,
      attackBuffExtraPerStack: specs.industrial.attackBuffExtraPerStack,
      defenseFlat: specs.industrial.defenseFlat,
      defenseExtraPerStack: specs.industrial.defenseExtraPerStack,
      maxSecuredPercent: 100 - specs.industrial.defenseFlat,
    },
    financial: {
      id: "financial" as const,
      label: specs.financial.label,
      blurb: specs.financial.blurb,
      workCooldownCutMinutes: specs.financial.workCooldownCutMinutes,
      workCooldownExtraPerStack: specs.financial.workCooldownExtraPerStack,
      collectBonusPercent: specs.financial.collectBonusPercent,
      collectBonusExtraPerStack: specs.financial.collectBonusExtraPerStack,
    },
  };
}

export async function getTerritoryBoard(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vault: true, base: true },
  });
  if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");

  const unlocked = user.reputationLevel >= RULES.TERRITORY.UNLOCK_LEVEL;
  // Settle from the loaded user — no second read. Below 11 police never moves.
  const policeNow = unlocked
    ? await settlePolice(userId, {
        policeAttention: user.policeAttention,
        policeSettledOn: user.policeSettledOn,
        reputationLevel: user.reputationLevel,
      })
    : 0;
  const holdings = await prisma.territoryHolding.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const active = await prisma.expansionOp.findFirst({
    where: { userId, closedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const owned = await ownedSectorIds(userId);
  const vaultBal = user.vault?.balance ?? 0;
  const capitalOk = vaultBal >= RULES.TERRITORY.VAULT_CAPITAL_REQUIRED;
  const cap = maxSectors(user.reputationLevel);
  const used = owned.length;
  const needsSpecialization = holdings.some((h) => !h.specialization);
  const passives = await territoryPassives(userId);

  return {
    unlocked,
    unlockLevel: RULES.TERRITORY.UNLOCK_LEVEL,
    capitalRequired: RULES.TERRITORY.VAULT_CAPITAL_REQUIRED,
    capitalOk,
    vaultBalance: vaultBal,
    vaultCreditCard: user.vaultCreditCard,
    policeAttention: policeNow,
    policeBand: policeBand(policeNow),
    vaultYieldPerDay:
      (user.vault?.tier === RULES.TERRITORY.VAULT_YIELD_REQUIRES_TIER || user.vault?.tier === "platinum") && unlocked
        ? Math.round((Math.pow(1 + vaultYieldPctPerHour(policeNow) / 100, 24) - 1) * 1000) / 10
        : 0,
    maxSectors: cap,
    usedSectors: used,
    nextClaimFee: used < cap ? territoryClaimFee(used + 1, user.reputationLevel) : null,
    claimFees: TERRITORY_CLAIM_FEES,
    needsSpecialization,
    passives,
    canExpand:
      unlocked &&
      capitalOk &&
      used < cap &&
      !active &&
      !needsSpecialization &&
      policeNow < RULES.TERRITORY.CRITICAL_BLOCKS_EXPAND,
    stages: [...STAGES],
    base: user.base
      ? {
          sectorId: user.base.sectorId,
          landmassId: user.base.landmassId,
          regionName: user.base.regionName,
          name: user.base.name,
        }
      : null,
    holdings: holdings.map((h) => ({
      id: h.id,
      sectorId: h.sectorId,
      landmassId: h.landmassId,
      regionName: h.regionName,
      specialization: h.specialization,
      mapColor: h.mapColor ?? null,
      securedAt: h.securedAt.toISOString(),
    })),
    mapColors: TERRITORY_MAP_COLORS.map((c) => ({ id: c.id, hex: c.hex, label: c.label })),
    pigmentKits: await prisma.modOwned.count({
      where: { userId, modId: "sector-pigment-kit", kind: "territory", status: "inventory" },
    }),
    activeOp: active
      ? {
          id: active.id,
          sectorId: active.sectorId,
          landmassId: active.landmassId,
          regionName: active.regionName,
          stage: active.stage,
          completesAt: active.completesAt?.toISOString() ?? null,
          ready: !active.completesAt || active.completesAt.getTime() <= Date.now(),
          nextStage: active.stage === "scout" ? "claim" : null,
        }
      : null,
    specializations: specCatalog(),
  };
}

/** Scout any empty map sector (step 1 of scout → claim). */
export async function startScout(
  userId: string,
  input: { sectorId: string; landmassId: string; regionName: string },
) {
  const user = await assertUnlocked(userId);
  await settlePolice(userId);
  const fresh = await prisma.user.findUnique({ where: { id: userId } });
  if (!fresh) throw new GameError(404, "NOT_FOUND", "Player not found.");
  if (policePoints(fresh.policeAttention, fresh.policeSettledOn) >= RULES.TERRITORY.CRITICAL_BLOCKS_EXPAND) {
    throw new GameError(400, "POLICE_CRITICAL", "Police attention is critical. Wait for decay before expanding.");
  }
  const pendingSpec = await prisma.territoryHolding.findFirst({
    where: { userId, specialization: null },
  });
  if (pendingSpec) {
    throw new GameError(400, "SPEC_REQUIRED", "Choose Industrial or Financial for your last claim first.");
  }
  const vaultBal = user.vault?.balance ?? 0;
  if (vaultBal < RULES.TERRITORY.VAULT_CAPITAL_REQUIRED) {
    throw new GameError(
      400,
      "CAPITAL_SHORT",
      `Hold at least $${RULES.TERRITORY.VAULT_CAPITAL_REQUIRED.toLocaleString("en-US")} in the vault to expand.`,
    );
  }
  const owned = await ownedSectorIds(userId);
  if (owned.length >= maxSectors(user.reputationLevel)) {
    throw new GameError(400, "SECTOR_CAP", "Sector cap for this reputation level is full.");
  }
  if (owned.includes(String(input.sectorId ?? "").trim())) {
    throw new GameError(400, "ALREADY_OWNED", "You already hold that sector.");
  }
  const open = await prisma.expansionOp.findFirst({ where: { userId, closedAt: null } });
  if (open) throw new GameError(400, "OP_ACTIVE", "Finish or abandon the current expansion first.");

  const sectorId = String(input.sectorId ?? "").trim();
  const landmassId = String(input.landmassId ?? "").trim();
  const regionName = String(input.regionName ?? "").trim() || "Unknown";
  if (!sectorId || !landmassId) {
    throw new GameError(400, "BAD_SECTOR", "Sector and landmass are required.");
  }
  if (await sectorTaken(sectorId)) {
    throw new GameError(409, "SECTOR_OCCUPIED", "That sector is already taken or under expansion.");
  }

  await prisma.expansionOp.create({
    data: {
      userId,
      sectorId,
      landmassId,
      regionName,
      stage: "scout",
      completesAt: null,
    },
  });
  await writeNotification(prisma, {
    userId,
    title: "Territory scouted",
    body: `${sectorId} is under scout. Open Territory and Claim it.`,
    severity: "INFO",
  });
  return getTerritoryBoard(userId);
}

/** Claim the scouted sector (scout → claim). */
export async function advanceExpansion(userId: string) {
  await assertUnlocked(userId);
  await settlePolice(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vault: true },
  });
  if (!user?.vault) throw new GameError(404, "NOT_FOUND", "Player not found.");
  if (user.vault.balance < RULES.TERRITORY.VAULT_CAPITAL_REQUIRED) {
    throw new GameError(400, "CAPITAL_SHORT", "Vault capital dipped below the hold requirement.");
  }

  const op = await prisma.expansionOp.findFirst({ where: { userId, closedAt: null } });
  if (!op) throw new GameError(400, "NO_OP", "No active expansion.");
  return finalizeClaim(userId, op.id);
}

async function finalizeClaim(userId: string, opId: string) {
  const policeAfter = await prisma.$transaction(async (tx) => {
    const op = await tx.expansionOp.findFirst({ where: { id: opId, userId, closedAt: null } });
    if (!op) throw new GameError(400, "NO_OP", "No active expansion.");

    const takenBase = await tx.base.findUnique({ where: { sectorId: op.sectorId } });
    const takenHold = await tx.territoryHolding.findUnique({ where: { sectorId: op.sectorId } });
    if (takenBase || takenHold) {
      throw new GameError(409, "SECTOR_OCCUPIED", "That sector was claimed by someone else.");
    }

    const ownedCount =
      (await tx.base.count({ where: { userId } })) + (await tx.territoryHolding.count({ where: { userId } }));
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
    if (ownedCount >= maxSectors(user.reputationLevel)) {
      throw new GameError(400, "SECTOR_CAP", "Sector cap reached.");
    }
    const nextSlot = ownedCount + 1;
    const claimFee = territoryClaimFee(nextSlot, user.reputationLevel);
    if (claimFee > 0) {
      await chargeSpend(tx, userId, claimFee);
      await tx.transaction.create({
        data: { type: "territory_claim_fee", amount: claimFee, fromUserId: userId },
      });
    }

    await tx.territoryHolding.create({
      data: {
        userId,
        sectorId: op.sectorId,
        landmassId: op.landmassId,
        regionName: op.regionName,
        specialization: null,
      },
    });
    await tx.expansionOp.update({
      where: { id: op.id },
      data: { closedAt: new Date(), stage: "claim", completesAt: null },
    });
    const policeMove = await addPoliceAttention(tx, userId, RULES.TERRITORY.POLICE_PER_EXPAND);
    await tx.transaction.create({
      data: { type: "territory_claim", amount: claimFee || 1, toUserId: userId },
    });
    await writeNotification(tx, {
      userId,
      title: "Territory claimed",
      body: `${op.sectorId} (${op.regionName}) is yours${claimFee ? ` · fee $${claimFee.toLocaleString("en-US")}` : ""}. Choose Industrial or Financial — permanent.`,
      severity: "INFO",
    });
    return policeMove.after;
  });
  if (policeAfter >= 55) await syncPoliceBounty(userId, policeAfter, false).catch(() => null);
  return getTerritoryBoard(userId);
}

export async function abandonExpansion(userId: string) {
  const op = await prisma.expansionOp.findFirst({ where: { userId, closedAt: null } });
  if (!op) throw new GameError(400, "NO_OP", "No active expansion.");
  await prisma.expansionOp.update({ where: { id: op.id }, data: { closedAt: new Date() } });
  await writeNotification(prisma, {
    userId,
    title: "Expansion abandoned",
    body: `Operation on ${op.sectorId} was cancelled.`,
    severity: "WARNING",
  });
  return getTerritoryBoard(userId);
}

/** One-time Industrial / Financial lock. Cannot change after. */
export async function setSpecialization(userId: string, holdingId: string, specialization: string | null) {
  await assertUnlocked(userId);
  if (!specialization || !Object.keys(RULES.TERRITORY.SPECIALIZATIONS).includes(specialization)) {
    throw new GameError(400, "BAD_SPEC", "Pick industrial or financial.");
  }
  const row = await prisma.territoryHolding.findFirst({ where: { id: holdingId, userId } });
  if (!row) throw new GameError(404, "NOT_FOUND", "Holding not found.");
  if (row.specialization) {
    throw new GameError(400, "SPEC_LOCKED", "Specialization is permanent and already set.");
  }
  await prisma.territoryHolding.update({
    where: { id: row.id },
    data: { specialization },
  });
  const catalog = specCatalog();
  const picked = specialization === "industrial" ? catalog.industrial : catalog.financial;
  await writeNotification(prisma, {
    userId,
    title: `${picked.label} locked in`,
    body: picked.blurb,
    severity: "INFO",
  });
  return getTerritoryBoard(userId);
}

/** Consume a Sector Pigment Kit to paint one expanded holding (not home base). */
export async function applyTerritoryColor(
  userId: string,
  holdingId: string,
  colorId: string,
  instanceId?: string,
) {
  await assertUnlocked(userId);
  const color = territoryMapColorById(colorId);
  if (!color) {
    throw new GameError(400, "BAD_COLOR", "Pick a colour from the pigment chart.");
  }
  if (!territoryModById("sector-pigment-kit")) {
    throw new GameError(500, "BAD_MOD", "Pigment kit is not configured.");
  }
  const holding = await prisma.territoryHolding.findFirst({ where: { id: holdingId, userId } });
  if (!holding) throw new GameError(404, "NOT_FOUND", "Holding not found.");

  await prisma.$transaction(async (tx) => {
    const mod = instanceId
      ? await tx.modOwned.findFirst({
          where: {
            id: instanceId,
            userId,
            modId: "sector-pigment-kit",
            kind: "territory",
            status: "inventory",
          },
        })
      : await tx.modOwned.findFirst({
          where: { userId, modId: "sector-pigment-kit", kind: "territory", status: "inventory" },
        });
    if (!mod) {
      throw new GameError(400, "NO_KIT", "Craft a Sector Pigment Kit in the Workshop first.");
    }
    await tx.territoryHolding.update({
      where: { id: holding.id },
      data: { mapColor: color.hex },
    });
    await tx.modOwned.delete({ where: { id: mod.id } });
    await writeNotification(tx, {
      userId,
      title: "Sector painted",
      body: `${holding.sectorId} is now ${color.label} on the map. The pigment kit was used up.`,
      severity: "INFO",
    });
  });
  return getTerritoryBoard(userId);
}
