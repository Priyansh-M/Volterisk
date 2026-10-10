import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import type { Tx } from "./economyService.js";
import { writeNotification } from "./notificationService.js";

const STEP_MS = RULES.HEAT_DECAY_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const GAP_MS = RULES.HEAT_CHECK_GAP_HOURS * 60 * 60 * 1000;
const SLACK_MS = DAY_MS - RULES.HEAT_CHECKS_PER_DAY * GAP_MS;
const NOON_RESET_TYPE = "heat_noon_reset";

function dayKey(dayStartMs: number): string {
  return new Date(dayStartMs).toISOString().slice(0, 10);
}

function utcDayStart(ms: number): number {
  const day = new Date(ms);
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
}

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

/** Three instants in one UTC day, each at least seven hours from the next, including across midnight. */
export function heatChecksForUtcDay(dayStartMs: number): number[] {
  const secret = process.env.JWT_SECRET || "iron-hour-local-dev";
  let seed = hashSeed(`${secret}:heat:${dayKey(dayStartMs)}`);
  const next = () => {
    seed = mix(seed + 0x9e3779b9);
    return seed / 4294967296;
  };
  const extraA = next() * SLACK_MS;
  const extraB = next() * (SLACK_MS - extraA);
  const origin = next() * DAY_MS;
  const raw = [origin, origin + GAP_MS + extraA, origin + GAP_MS * 2 + extraA + extraB].map(
    (offset) => dayStartMs + Math.floor(offset % DAY_MS),
  );
  raw.sort((a, b) => a - b);
  return raw;
}

function checksBetween(afterMs: number, nowMs: number): number[] {
  if (nowMs <= afterMs) return [];
  const hits: number[] = [];
  for (let day = utcDayStart(afterMs) - DAY_MS; day <= nowMs; day += DAY_MS) {
    for (const at of heatChecksForUtcDay(day)) {
      if (at > afterMs && at <= nowMs) hits.push(at);
    }
  }
  hits.sort((a, b) => a - b);
  return hits;
}

function warningToken(at: number): string {
  const secret = process.env.JWT_SECRET || "iron-hour-local-dev";
  return hashSeed(`${secret}:warn:${at}`).toString(16);
}

/** True only during the minute before a check. The response carries no clock time. */
export function heatWarning(now = Date.now()): { active: boolean; token: string | null } {
  const from = now - DAY_MS;
  const upcoming = checksBetween(from, now + RULES.HEAT_WARNING_MS);
  const hit = upcoming.find((at) => now >= at - RULES.HEAT_WARNING_MS && now < at);
  if (!hit) return { active: false, token: null };
  return { active: true, token: warningToken(hit) };
}

function decayed(heat: number, settledAt: Date, now: Date): { heat: number; settledAt: Date } {
  const ticks = Math.floor((now.getTime() - settledAt.getTime()) / STEP_MS);
  if (ticks <= 0) return { heat, settledAt };
  return {
    heat: Math.max(0, heat - ticks * RULES.HEAT_DECAY),
    settledAt: new Date(settledAt.getTime() + ticks * STEP_MS),
  };
}

function judgedMs(value: string | null, createdAt: Date): number {
  if (!value) return createdAt.getTime();
  const parsed = Date.parse(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(parsed) ? createdAt.getTime() : parsed;
}

/** Most recent 12:00 GMT that has already passed. */
export function latestHeatNoon(now = new Date()): Date {
  const noon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
  if (now.getTime() < noon.getTime()) noon.setUTCDate(noon.getUTCDate() - 1);
  return noon;
}

async function noonResetExists(tx: Tx, userId: string, noon: Date): Promise<boolean> {
  const row = await tx.transaction.findFirst({
    where: { type: NOON_RESET_TYPE, fromUserId: userId, createdAt: { gte: noon } },
    select: { id: true },
  });
  return Boolean(row);
}

/** Clears heat to 0 at the noon point. Call after checks that happened before noon. */
async function wipeHeatAtNoon(
  tx: Tx,
  userId: string,
  heat: number,
  settledAt: Date,
  noon: Date,
): Promise<{ heat: number; settledAt: Date }> {
  const cooled = decayed(heat, settledAt, noon);
  await tx.transaction.create({
    data: {
      type: NOON_RESET_TYPE,
      amount: cooled.heat,
      fromUserId: userId,
      createdAt: noon,
    },
  });
  if (cooled.heat > 0) {
    await writeNotification(tx, {
      userId,
      title: "Heat cleared",
      body: `Heat reset to 0 at 12:00 GMT. It was ${cooled.heat}.`,
      severity: "INFO",
    });
  }
  return { heat: 0, settledAt: noon };
}

/** Heat number only. Pocket cash stays put until a scheduled check. */
async function adjustHeat(tx: Tx, userId: string, delta: number, now = new Date()): Promise<number> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.isBot) return 0;
  let heat = user.heat;
  let settledAt = user.heatSettledAt;
  const noon = latestHeatNoon(now);
  if (!(await noonResetExists(tx, userId, noon))) {
    const wiped = await wipeHeatAtNoon(tx, userId, heat, settledAt, noon);
    heat = wiped.heat;
    settledAt = wiped.settledAt;
  }
  const cooled = decayed(heat, settledAt, now);
  heat = Math.max(0, cooled.heat + delta);
  await tx.user.update({
    where: { id: userId },
    data: { heat, heatSettledAt: cooled.settledAt },
  });
  if (cooled.heat <= RULES.HEAT_POLICE_AT && heat > RULES.HEAT_POLICE_AT) {
    await writeNotification(tx, {
      userId,
      title: "Heat is high",
      body: "Heat is above 50. A heat check takes half the cash in your pocket. Above 100, it takes all of it. The vault is not part of that.",
      severity: "WARNING",
    });
  }
  return heat;
}

/** Seizes pocket cash for check times that have already passed. Vault is never touched. */
async function seizeDueChecks(tx: Tx, userId: string, now = new Date()): Promise<number> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.isBot) return 0;
  let heat = user.heat;
  let settledAt = user.heatSettledAt;
  let cash = user.cash;
  let seized = 0;
  let judged = judgedMs(user.heatJudgedOn, user.createdAt);
  const noon = latestHeatNoon(now);
  let noonDone = await noonResetExists(tx, userId, noon);
  const due = checksBetween(judged, now.getTime());

  const ensureNoon = async (atMs: number) => {
    if (noonDone || atMs <= noon.getTime()) return;
    const wiped = await wipeHeatAtNoon(tx, userId, heat, settledAt, noon);
    heat = wiped.heat;
    settledAt = wiped.settledAt;
    noonDone = true;
  };

  let lastHeatAtCheck = heat;
  let checksRun = 0;
  for (const at of due) {
    await ensureNoon(at);
    const cooled = decayed(heat, settledAt, new Date(at));
    heat = cooled.heat;
    settledAt = cooled.settledAt;
    judged = at;
    checksRun += 1;
    lastHeatAtCheck = heat;
    const take =
      cash > 0 && heat > RULES.HEAT_POLICE_AT
        ? heat > RULES.HEAT_POLICE_WIPE_AT
          ? cash
          : Math.floor(cash / 2)
        : 0;
    if (take > 0) {
      cash -= take;
      seized += take;
      await tx.transaction.create({
        data: { type: "police_seizure", amount: take, fromUserId: userId },
      });
    }
  }

  if (!noonDone) {
    const wiped = await wipeHeatAtNoon(tx, userId, heat, settledAt, noon);
    heat = wiped.heat;
    settledAt = wiped.settledAt;
  }

  if (checksRun > 0) {
    if (seized > 0) {
      await writeNotification(tx, {
        userId,
        title: "Cash seized",
        body:
          lastHeatAtCheck > RULES.HEAT_POLICE_WIPE_AT
            ? `Heat ${lastHeatAtCheck}. A heat check took every dollar in your pocket. The vault was left alone.`
            : `Heat ${lastHeatAtCheck}. A heat check took $${seized.toLocaleString()} from your pocket. The vault was left alone.`,
        severity: "CRITICAL",
      });
    } else {
      await writeNotification(tx, {
        userId,
        title: "Heat check",
        body:
          lastHeatAtCheck > RULES.HEAT_POLICE_AT
            ? `Heat ${lastHeatAtCheck}. A heat check ran. Your pocket was already empty, so nothing was taken. The vault was left alone.`
            : `Heat ${lastHeatAtCheck}. A heat check ran. Pocket cash stayed put. The vault was left alone.`,
        severity: "WARNING",
      });
    }
  }

  const cooled = decayed(heat, settledAt, now);
  await tx.user.update({
    where: { id: userId },
    data: {
      ...(seized > 0 ? { cash: { decrement: seized } } : {}),
      heat: cooled.heat,
      heatSettledAt: cooled.settledAt,
      heatJudgedOn: new Date(judged).toISOString(),
    },
  });
  return cooled.heat;
}

export async function gainHeat(tx: Tx, userId: string, amount: number): Promise<void> {
  if (amount === 0) return;
  await adjustHeat(tx, userId, amount);
}

export async function coolHeat(tx: Tx, userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await adjustHeat(tx, userId, -amount);
}

export async function settleHeat(userId: string): Promise<number> {
  return prisma.$transaction((tx) => seizeDueChecks(tx, userId, new Date()));
}

/** In-memory skip so heat warning / profile polls do not hammer noon + decay every few seconds. */
const noonSettledKey = new Map<string, number>();
const heatStateFreshUntil = new Map<string, number>();

/** Applies the 12:00 GMT wipe when that noon has passed and has not been recorded yet. */
export async function settleHeatNoonIfDue(userId: string): Promise<void> {
  const noon = latestHeatNoon();
  const noonMs = noon.getTime();
  if ((noonSettledKey.get(userId) ?? 0) >= noonMs) return;
  const already = await prisma.transaction.findFirst({
    where: { type: NOON_RESET_TYPE, fromUserId: userId, createdAt: { gte: noon } },
    select: { id: true },
  });
  if (already) {
    noonSettledKey.set(userId, noonMs);
    return;
  }
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.isBot) {
      noonSettledKey.set(userId, noonMs);
      return;
    }
    if (await noonResetExists(tx, userId, noon)) {
      noonSettledKey.set(userId, noonMs);
      return;
    }
    const wiped = await wipeHeatAtNoon(tx, userId, user.heat, user.heatSettledAt, noon);
    await tx.user.update({
      where: { id: userId },
      data: { heat: wiped.heat, heatSettledAt: wiped.settledAt },
    });
  });
  noonSettledKey.set(userId, noonMs);
}

/**
 * Noon wipe plus idle decay (−5 / 2h). Profile loads must call this or heat
 * only moves when a heist, job, or police check touches the meter.
 * Skips DB work for ~90s per isolate after a no-op / successful settle.
 */
export async function settleHeatState(userId: string): Promise<void> {
  const now = Date.now();
  if ((heatStateFreshUntil.get(userId) ?? 0) > now) return;
  await settleHeatNoonIfDue(userId);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.isBot) return;
    const cooled = decayed(user.heat, user.heatSettledAt, new Date());
    if (
      cooled.heat === user.heat &&
      cooled.settledAt.getTime() === user.heatSettledAt.getTime()
    ) {
      return;
    }
    await tx.user.update({
      where: { id: userId },
      data: { heat: cooled.heat, heatSettledAt: cooled.settledAt },
    });
  });
  // Decay ticks every 2h; longer TTL cuts free-tier settle spam from polls.
  heatStateFreshUntil.set(userId, now + 120_000);
}

function latestCheckAt(nowMs: number): number | null {
  let latest: number | null = null;
  for (let day = utcDayStart(nowMs) - DAY_MS; day <= nowMs; day += DAY_MS) {
    for (const at of heatChecksForUtcDay(day)) {
      if (at <= nowMs && (latest === null || at > latest)) latest = at;
    }
  }
  return latest;
}

/** True for a few minutes after a check, so the warning poll can settle once. */
export function heatNeedsTouch(now = Date.now()): boolean {
  const at = latestCheckAt(now);
  return at !== null && now - at <= 3 * 60 * 1000;
}

const settledPast = new Map<string, number>();

/** One indexed read, and only when a check has passed since this player was last settled. */
export async function settleHeatIfDue(userId: string): Promise<void> {
  await settleHeatNoonIfDue(userId);
  const now = Date.now();
  const at = latestCheckAt(now);
  if (at === null) return;
  if ((settledPast.get(userId) ?? 0) >= at) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBot: true, createdAt: true, heatJudgedOn: true },
  });
  if (!user || user.isBot) {
    settledPast.set(userId, at);
    return;
  }
  const due = checksBetween(judgedMs(user.heatJudgedOn, user.createdAt), now);
  if (due.length === 0) {
    settledPast.set(userId, at);
    return;
  }
  await settleHeat(userId);
  settledPast.set(userId, at);
}

export function heistHeatGain(success: boolean, amountStolen: number): number {
  if (!success) return RULES.HEAT_FAIL;
  return amountStolen >= RULES.HEAT_HIGH_VALUE_AT ? RULES.HEAT_HIGH_VALUE : RULES.HEAT_SUCCESS;
}
