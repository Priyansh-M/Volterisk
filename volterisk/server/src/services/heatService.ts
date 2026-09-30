import { randomInt } from "node:crypto";
import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import type { Tx } from "./economyService.js";
import { writeNotification } from "./notificationService.js";

const STEP_MS = RULES.HEAT_DECAY_HOURS * 60 * 60 * 1000;

function latestNoon(now: Date): Date {
  const noon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
  if (now.getTime() < noon.getTime()) noon.setUTCDate(noon.getUTCDate() - 1);
  return noon;
}

function decayed(heat: number, settledAt: Date, now: Date): { heat: number; settledAt: Date } {
  const ticks = Math.floor((now.getTime() - settledAt.getTime()) / STEP_MS);
  if (ticks <= 0) return { heat, settledAt };
  return {
    heat: Math.max(0, heat - ticks * RULES.HEAT_DECAY),
    settledAt: new Date(settledAt.getTime() + ticks * STEP_MS),
  };
}

async function applyHeat(
  tx: Tx,
  userId: string,
  delta: number,
  now = new Date(),
): Promise<number> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.isBot) return 0;
  const cooled = decayed(user.heat, user.heatSettledAt, now);
  let heat = Math.max(0, cooled.heat + delta);
  const noon = latestNoon(now);
  const stamp = noon.toISOString();
  const judged = user.heatJudgedOn && user.heatJudgedOn.length === 10 ? `${user.heatJudgedOn}T00:00:00.000Z` : user.heatJudgedOn;
  let seized = 0;
  if (judged && judged < stamp && heat > RULES.HEAT_POLICE_AT) {
    const roll = randomInt(1, 101);
    if (roll <= RULES.HEAT_POLICE_CHANCE && user.cash > 0) {
      seized = user.cash;
      await tx.user.update({ where: { id: userId }, data: { cash: 0 } });
      await tx.transaction.create({
        data: { type: "police_seizure", amount: seized, fromUserId: userId },
      });
      await writeNotification(tx, {
        userId,
        title: "Cash seized",
        body: `Heat ${heat} at 12:00 GMT. The police took ${seized.toLocaleString("en-US")} from your pocket. The vault was left alone.`,
        severity: "CRITICAL",
      });
    }
  }
  await tx.user.update({
    where: { id: userId },
    data: {
      heat,
      heatSettledAt: cooled.settledAt,
      heatJudgedOn: stamp,
    },
  });
  if (cooled.heat <= RULES.HEAT_POLICE_AT && heat > RULES.HEAT_POLICE_AT) {
    await writeNotification(tx, {
      userId,
      title: "Heat is high",
      body: `Heat is ${heat}. At 12:00 GMT, if it is still above 50, pocket cash can be taken. The vault is not part of that.`,
      severity: "WARNING",
    });
  }
  return heat;
}

export async function gainHeat(tx: Tx, userId: string, amount: number): Promise<void> {
  if (amount === 0) return;
  await applyHeat(tx, userId, amount);
}

export async function coolHeat(tx: Tx, userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await applyHeat(tx, userId, -amount);
}

export async function settleHeat(userId: string): Promise<number> {
  return prisma.$transaction((tx) => applyHeat(tx, userId, 0));
}

export async function settleAllHeat(): Promise<void> {
  const users = await prisma.user.findMany({ where: { isBot: false }, select: { id: true } });
  for (const user of users) await settleHeat(user.id);
}

export function heistHeatGain(success: boolean, amountStolen: number): number {
  if (!success) return RULES.HEAT_FAIL;
  return amountStolen >= RULES.HEAT_HIGH_VALUE_AT ? RULES.HEAT_HIGH_VALUE : RULES.HEAT_SUCCESS;
}
