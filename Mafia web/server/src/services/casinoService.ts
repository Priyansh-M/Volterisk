import { randomInt } from "node:crypto";
import { GameError } from "../game/errors.js";
import { prisma } from "../prisma.js";
import { creditCash, debitCash } from "./economyService.js";

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const EVEN_MONEY = new Set(["ODD", "EVEN", "1_TO_18", "19_TO_36", "RED", "BLACK"]);
const TRIPLES = new Set(["1ST_COLUMN", "2ND_COLUMN", "3RD_COLUMN", "1ST_DOZEN", "2ND_DOZEN", "3RD_DOZEN"]);

function scale(id: string): number {
  if (/^\d+$/.test(id)) return 36;
  if (EVEN_MONEY.has(id)) return 2;
  if (TRIPLES.has(id)) return 3;
  const parts = id.split("-");
  if (parts.length > 1 && parts.every((part) => /^\d+$/.test(part))) return Math.floor(36 / parts.length);
  return 0;
}

function hits(id: string, number: number): boolean {
  if (/^\d+$/.test(id)) return Number(id) === number;
  if (id === "RED") return RED.has(number);
  if (id === "BLACK") return number !== 0 && !RED.has(number);
  if (id === "EVEN") return number !== 0 && number % 2 === 0;
  if (id === "ODD") return number % 2 === 1;
  if (id === "1_TO_18") return number >= 1 && number <= 18;
  if (id === "19_TO_36") return number >= 19 && number <= 36;
  if (id === "1ST_DOZEN") return number >= 1 && number <= 12;
  if (id === "2ND_DOZEN") return number >= 13 && number <= 24;
  if (id === "3RD_DOZEN") return number >= 25 && number <= 36;
  if (id === "1ST_COLUMN") return number > 0 && number % 3 === 1;
  if (id === "2ND_COLUMN") return number > 0 && number % 3 === 2;
  if (id === "3RD_COLUMN") return number > 0 && number % 3 === 0;
  const parts = id.split("-");
  if (parts.length > 1 && parts.every((part) => /^\d+$/.test(part) && Number(part) <= 36)) {
    return parts.includes(String(number));
  }
  return false;
}

export async function spinRoulette(userId: string, rawBets: { id?: unknown; amount?: unknown }[]) {
  if (!Array.isArray(rawBets) || rawBets.length === 0 || rawBets.length > 40) {
    throw new GameError(400, "BAD_BETS", "Place at least one chip before the spin.");
  }
  const bets = rawBets.map((row) => {
    const id = String(row.id ?? "");
    const amount = Number(row.amount);
    const payout = scale(id);
    if (!Number.isInteger(amount) || amount <= 0 || payout === 0 || id.includes("00")) {
      throw new GameError(400, "BAD_BETS", "One of those chips is not a European bet.");
    }
    return { id, amount, payout };
  });
  const stake = bets.reduce((sum, bet) => sum + bet.amount, 0);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { vault: true } });
    if (!user?.vault) throw new GameError(404, "NOT_FOUND", "Player not found.");
    const cap = Math.floor((user.cash + user.vault.balance) * 0.05);
    if (stake > cap) {
      throw new GameError(400, "OVER_CAP", `A spin can stake at most 5% of your total. That cap is ${cap}.`);
    }
    if (stake > user.cash) {
      throw new GameError(400, "INSUFFICIENT_FUNDS", "Not enough cash. Check your vault.");
    }
    await debitCash(tx, userId, stake);
    const number = randomInt(0, 37);
    const returned = bets.reduce((sum, bet) => sum + (hits(bet.id, number) ? bet.amount * bet.payout : 0), 0);
    if (returned > 0) await creditCash(tx, userId, returned);
    await tx.transaction.create({
      data: { type: "roulette", amount: stake, fromUserId: userId },
    });
    const fresh = await tx.user.findUnique({ where: { id: userId }, select: { cash: true } });
    return { number: String(number), stake, returned, cash: fresh?.cash ?? 0, cap };
  });
}
