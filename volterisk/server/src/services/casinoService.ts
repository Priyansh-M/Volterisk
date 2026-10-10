import { randomInt } from "node:crypto";
import { GameError } from "../game/errors.js";
import { prisma } from "../prisma.js";
import { chargeSpend, creditEarn } from "./economyService.js";
import { writeNotification } from "./notificationService.js";

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

function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function liveCap(cash: number, vault: number) {
  return Math.floor((cash + vault) * 0.05);
}

export async function rouletteStatus(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { vault: true } });
  if (!user?.vault) throw new GameError(404, "NOT_FOUND", "Player not found.");
  const day = utcDay();
  const fresh = user.rouletteDay !== day;
  const cap = fresh ? liveCap(user.cash, user.vault.balance) : user.rouletteCap;
  const staked = fresh ? 0 : user.rouletteStaked;
  return { cap, staked, locked: cap > 0 && staked >= cap, day };
}

export async function spinRoulette(userId: string, rawBets: { id?: unknown; amount?: unknown }[], fixedNumber?: number) {
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
    const day = utcDay();
    const fresh = user.rouletteDay !== day;
    const cap = fresh ? liveCap(user.cash, user.vault.balance) : user.rouletteCap;
    const already = fresh ? 0 : user.rouletteStaked;
    if (cap <= 0 || already >= cap) {
      throw new GameError(409, "TABLE_CLOSED", "The day's allowance is spent. Come back tomorrow.");
    }
    if (already + stake > cap) {
      throw new GameError(400, "OVER_CAP", `That spin passes today's cap of ${cap}. ${cap - already} is left.`);
    }
    if (stake > user.cash) {
      throw new GameError(400, "INSUFFICIENT_FUNDS", "Not enough cash. Check your vault.");
    }
    await chargeSpend(tx, userId, stake);
    await tx.user.update({
      where: { id: userId },
      data: { rouletteDay: day, rouletteCap: cap, rouletteStaked: already + stake },
    });
    const number = fixedNumber ?? randomInt(0, 37);
    const returned = bets.reduce((sum, bet) => sum + (hits(bet.id, number) ? bet.amount * bet.payout : 0), 0);
    if (returned > 0) await creditEarn(tx, userId, returned);
    await tx.transaction.create({
      data: { type: "roulette", amount: stake, fromUserId: userId },
    });
    const after = await tx.user.findUnique({ where: { id: userId }, select: { cash: true, rouletteStaked: true, rouletteCap: true } });
    const staked = after?.rouletteStaked ?? already + stake;
    const heldCap = after?.rouletteCap ?? cap;
    return {
      number: String(number),
      stake,
      returned,
      cash: after?.cash ?? 0,
      cap: heldCap,
      staked,
      locked: staked >= heldCap,
    };
  });
}

const TABLE_MAX = 5;

async function lobbyView(lobbyId: string, viewerId: string) {
  const lobby = await prisma.rouletteLobby.findUnique({
    where: { id: lobbyId },
    include: { seats: true, invites: { where: { status: "pending" } } },
  });
  if (!lobby) throw new GameError(404, "NO_LOBBY", "That table is gone.");
  const ids = [...lobby.seats.map((seat) => seat.userId), ...lobby.invites.map((row) => row.toId), lobby.hostId];
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } });
  const name = new Map(people.map((row) => [row.id, row.username]));
  const mine = lobby.seats.find((seat) => seat.userId === viewerId);
  return {
    id: lobby.id,
    hostId: lobby.hostId,
    hostName: name.get(lobby.hostId) ?? "Host",
    youAreHost: lobby.hostId === viewerId,
    spinToken: lobby.spinToken,
    lastNumber: lobby.lastNumber,
    seats: lobby.seats.map((seat) => {
      let bets: { id: string; amount: number }[] = [];
      try {
        const parsed = JSON.parse(seat.betsJson) as { id?: string; amount?: number }[];
        if (Array.isArray(parsed)) {
          bets = parsed.filter((row) => row.id && Number(row.amount) > 0).map((row) => ({ id: String(row.id), amount: Number(row.amount) }));
        }
      } catch {
        bets = [];
      }
      return {
        userId: seat.userId,
        username: name.get(seat.userId) ?? "Player",
        laid: bets.length > 0,
        bets,
      };
    }),
    invites: lobby.invites.map((row) => ({ userId: row.toId, username: name.get(row.toId) ?? "Player" })),
    yourResult: mine?.resultJson ? (JSON.parse(mine.resultJson) as { number: string; returned: number; stake: number }) : null,
  };
}

export async function createLobby(userId: string) {
  await prisma.rouletteSeat.deleteMany({ where: { userId } });
  const lobby = await prisma.rouletteLobby.create({
    data: { hostId: userId, seats: { create: { userId } } },
  });
  return lobbyView(lobby.id, userId);
}

export async function readLobby(userId: string, lobbyId: string) {
  const seat = await prisma.rouletteSeat.findFirst({ where: { lobbyId, userId } });
  if (!seat) throw new GameError(403, "NOT_SEATED", "You are not at that table.");
  return lobbyView(lobbyId, userId);
}

export async function searchPlayers(userId: string, raw: string) {
  const q = raw.trim();
  if (q.length < 1) return [];
  const rows = await prisma.user.findMany({
    where: { isBot: false, id: { not: userId }, usernameKey: { contains: q.toLowerCase() } },
    select: { id: true, username: true },
    take: 8,
    orderBy: { username: "asc" },
  });
  return rows;
}

export async function invitePlayer(hostId: string, lobbyId: string, targetId: string) {
  const lobby = await prisma.rouletteLobby.findUnique({ where: { id: lobbyId }, include: { seats: true, invites: { where: { status: "pending" } } } });
  if (!lobby || lobby.hostId !== hostId) throw new GameError(403, "NOT_HOST", "Only the host invites.");
  if (lobby.seats.length + lobby.invites.length >= TABLE_MAX) throw new GameError(409, "TABLE_FULL", "Five is the table limit.");
  if (targetId === hostId) throw new GameError(400, "BAD_INVITE", "You are already seated.");
  if (lobby.seats.some((seat) => seat.userId === targetId)) return lobbyView(lobbyId, hostId);
  const target = await prisma.user.findFirst({ where: { id: targetId, isBot: false } });
  if (!target) throw new GameError(404, "NO_PLAYER", "No such player.");
  const host = await prisma.user.findUnique({ where: { id: hostId }, select: { username: true } });
  await prisma.rouletteInvite.upsert({
    where: { lobbyId_toId: { lobbyId, toId: targetId } },
    update: { status: "pending", fromId: hostId },
    create: { lobbyId, fromId: hostId, toId: targetId },
  });
  await prisma.$transaction((tx) =>
    writeNotification(tx, {
      userId: targetId,
      title: "Roulette invite",
      body: JSON.stringify({ by: host?.username ?? "A player", lobbyId }),
      severity: "INFO",
    }),
  );
  return lobbyView(lobbyId, hostId);
}

export async function acceptInvite(userId: string, lobbyId: string) {
  const invite = await prisma.rouletteInvite.findUnique({ where: { lobbyId_toId: { lobbyId, toId: userId } } });
  if (!invite || invite.status !== "pending") throw new GameError(404, "NO_INVITE", "That invite is gone.");
  const lobby = await prisma.rouletteLobby.findUnique({ where: { id: lobbyId }, include: { seats: true } });
  if (!lobby) throw new GameError(404, "NO_LOBBY", "That table is gone.");
  if (lobby.seats.length >= TABLE_MAX) throw new GameError(409, "TABLE_FULL", "That table is full.");
  await prisma.rouletteSeat.deleteMany({ where: { userId } });
  await prisma.$transaction([
    prisma.rouletteSeat.create({ data: { lobbyId, userId } }),
    prisma.rouletteInvite.update({ where: { id: invite.id }, data: { status: "accepted" } }),
  ]);
  return lobbyView(lobbyId, userId);
}

export async function layBets(userId: string, lobbyId: string, rawBets: { id?: unknown; amount?: unknown }[]) {
  const seat = await prisma.rouletteSeat.findFirst({ where: { lobbyId, userId } });
  if (!seat) throw new GameError(403, "NOT_SEATED", "You are not at that table.");
  if (!Array.isArray(rawBets) || rawBets.length > 40) throw new GameError(400, "BAD_BETS", "Those chips are not on the felt.");
  const cleaned = rawBets.map((row) => ({ id: String(row.id ?? ""), amount: Number(row.amount) })).filter((row) => row.id && row.amount > 0);
  await prisma.rouletteSeat.update({ where: { id: seat.id }, data: { betsJson: JSON.stringify(cleaned) } });
  return { laid: cleaned.length };
}

export async function spinTable(hostId: string, lobbyId: string) {
  const lobby = await prisma.rouletteLobby.findUnique({ where: { id: lobbyId }, include: { seats: true } });
  if (!lobby || lobby.hostId !== hostId) throw new GameError(403, "NOT_HOST", "The host spins the wheel.");
  const waiting = lobby.seats.some((seat) => {
    try {
      const bets = JSON.parse(seat.betsJson) as unknown[];
      return !Array.isArray(bets) || bets.length === 0;
    } catch {
      return true;
    }
  });
  if (waiting) throw new GameError(409, "WAITING", "Everyone at the table needs chips down, including you.");
  const number = randomInt(0, 37);
  for (const seat of lobby.seats) {
    const bets = JSON.parse(seat.betsJson) as { id: string; amount: number }[];
    if (!bets.length) {
      await prisma.rouletteSeat.update({ where: { id: seat.id }, data: { resultJson: "" } });
      continue;
    }
    try {
      const result = await spinRoulette(seat.userId, bets, number);
      await prisma.rouletteSeat.update({
        where: { id: seat.id },
        data: { betsJson: "[]", resultJson: JSON.stringify({ number: result.number, returned: result.returned, stake: result.stake }) },
      });
    } catch {
      await prisma.rouletteSeat.update({ where: { id: seat.id }, data: { betsJson: "[]", resultJson: "" } });
    }
  }
  await prisma.rouletteLobby.update({
    where: { id: lobbyId },
    data: { lastNumber: String(number), lastSpinAt: new Date(), spinToken: { increment: 1 } },
  });
  return lobbyView(lobbyId, hostId);
}

export async function leaveLobby(userId: string, lobbyId: string) {
  const lobby = await prisma.rouletteLobby.findUnique({ where: { id: lobbyId }, include: { seats: true } });
  if (!lobby) return { ok: true };
  if (lobby.hostId === userId) {
    const others = lobby.seats.filter((seat) => seat.userId !== userId);
    await prisma.$transaction(async (tx) => {
      for (const seat of others) {
        await writeNotification(tx, {
          userId: seat.userId,
          title: "Game ended",
          body: "Game has ended",
          severity: "INFO",
        });
      }
      await tx.rouletteLobby.delete({ where: { id: lobbyId } });
    });
    return { ok: true, closed: true };
  }
  await prisma.rouletteSeat.deleteMany({ where: { lobbyId, userId } });
  return { ok: true, closed: false };
}
