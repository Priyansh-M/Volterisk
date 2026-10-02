import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import type { Tx } from "./economyService.js";
import { writeNotification } from "./notificationService.js";

const STEP_MS = RULES.HEAT_DECAY_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const GAP_MS = RULES.HEAT_CHECK_GAP_HOURS * 60 * 60 * 1000;
const SLACK_MS = DAY_MS - RULES.HEAT_CHECKS_PER_DAY * GAP_MS;

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

/** Heat number only. Pocket cash stays put until a scheduled check. */
async function adjustHeat(tx: Tx, userId: string, delta: number, now = new Date()): Promise<number> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.isBot) return 0;
  const cooled = decayed(user.heat, user.heatSettledAt, now);
  const heat = Math.max(0, cooled.heat + delta);
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
  const due = checksBetween(judged, now.getTime());
  if (due.length === 0) return heat;

  for (const at of due) {
    const cooled = decayed(heat, settledAt, new Date(at));
    heat = cooled.heat;
    settledAt = cooled.settledAt;
    judged = at;
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
      await writeNotification(tx, {
        userId,
        title: "Cash seized",
        body:
          heat > RULES.HEAT_POLICE_WIPE_AT
            ? `Heat ${heat}. A heat check took every dollar in your pocket. The vault was left alone.`
            : `Heat ${heat}. A heat check took half the cash in your pocket. The vault was left alone.`,
        severity: "CRITICAL",
      });
      continue;
    }
    await writeNotification(tx, {
      userId,
      title: "Heat check",
      body:
        heat > RULES.HEAT_POLICE_AT
          ? `Heat ${heat}. A heat check ran. Your pocket was already empty, so nothing was taken. The vault was left alone.`
          : `Heat ${heat}. A heat check ran. Pocket cash stayed put. The vault was left alone.`,
      severity: "WARNING",
    });
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
