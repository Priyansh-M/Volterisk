import { randomInt } from "node:crypto";
import { GameError } from "../game/errors.js";
import { playerNetWorth, RULES } from "../game/rules.js";
import { evaluateSlots, spinReels, slotMachine, type SlotSymbol } from "../game/slots.js";
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

function liveCap(user: {
  cash: number;
  vaultCreditCard: boolean;
  reputationLevel: number;
  vault: { balance: number } | null;
}, pct: number) {
  return Math.floor(playerNetWorth(user) * pct);
}

function dayKey(raw: string | null | undefined) {
  return (raw ?? "").slice(0, 10);
}

/** Rob-the-vault style window: flips at 12:00 GMT. */
function noonKey(now = new Date()) {
  return new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type SlotsPack = { staked: number; cap: number; noon: string; sevens: number; vault: number; wins: number; sevensWins: number };

const SLOT_WIN_BIT: Record<string, number> = { fruit: 1, sevens: 2, vault: 4 };

function readSlotsPack(raw: string | null | undefined, moneyDay: string, noon = noonKey()): SlotsPack {
  const parts = (raw ?? "").split("|");
  const moneyOk = parts[0] === moneyDay;
  const noonOk = parts[3] === noon;
  return {
    staked: moneyOk ? Math.max(0, Number(parts[1]) || 0) : 0,
    cap: moneyOk ? Math.max(0, Number(parts[2]) || 0) : 0,
    noon,
    sevens: noonOk ? Math.max(0, Number(parts[4]) || 0) : 0,
    vault: noonOk ? Math.max(0, Number(parts[5]) || 0) : 0,
    wins: moneyOk ? Math.max(0, Number(parts[6]) || 0) : 0,
    sevensWins: noonOk ? Math.max(0, Number(parts[7]) || 0) : 0,
  };
}

function writeCasinoDay(moneyDay: string, raw: string | null | undefined, slots?: SlotsPack) {
  const pack = slots ?? readSlotsPack(raw, moneyDay);
  if (pack.staked <= 0 && pack.cap <= 0 && pack.sevens <= 0 && pack.vault <= 0 && pack.wins <= 0 && pack.sevensWins <= 0) return moneyDay;
  return `${moneyDay}|${pack.staked}|${pack.cap}|${pack.noon}|${pack.sevens}|${pack.vault}|${pack.wins}|${pack.sevensWins}`;
}

function tryLimit(machineId: string) {
  if (machineId === "sevens") return RULES.CASINO.SLOTS_SEVENS_TRIES;
  if (machineId === "vault") return RULES.CASINO.SLOTS_VAULT_TRIES;
  return 0;
}

function triesView(pack: SlotsPack) {
  return {
    sevens: { used: pack.sevens, max: RULES.CASINO.SLOTS_SEVENS_TRIES },
    vault: { used: pack.vault, max: RULES.CASINO.SLOTS_VAULT_TRIES },
  };
}

export async function rouletteStatus(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { vault: true } });
  if (!user?.vault) throw new GameError(404, "NOT_FOUND", "Player not found.");
  const day = utcDay();
  const fresh = dayKey(user.rouletteDay) !== day || user.rouletteCap <= 0;
  const cap = fresh ? liveCap(user, RULES.CASINO.ROULETTE_CAP) : user.rouletteCap;
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
    const fresh = dayKey(user.rouletteDay) !== day || user.rouletteCap <= 0;
    const cap = fresh ? liveCap(user, RULES.CASINO.ROULETTE_CAP) : user.rouletteCap;
    const already = fresh ? 0 : user.rouletteStaked;
    if (cap <= 0 || already >= cap) {
      throw new GameError(409, "TABLE_CLOSED", "The day's allowance is spent. Come back tomorrow.");
    }
    if (already + stake > cap) {
      throw new GameError(400, "OVER_CAP", `That spin passes today's cap of ${cap}. ${cap - already} is left.`);
    }
    const card = Boolean(user.vaultCreditCard) || user.reputationLevel >= 11;
    const spendable = card ? user.vault.balance : user.cash;
    if (stake > spendable) {
      throw new GameError(
        400,
        "INSUFFICIENT_FUNDS",
        card ? "Not enough card balance in the vault." : "Not enough cash. Check your vault.",
      );
    }
    await chargeSpend(tx, userId, stake);
    await tx.user.update({
      where: { id: userId },
      data: {
        rouletteDay: writeCasinoDay(day, user.rouletteDay),
        rouletteCap: cap,
        rouletteStaked: already + stake,
      },
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

export async function slotsStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cash: true,
      vaultCreditCard: true,
      reputationLevel: true,
      rouletteDay: true,
      vault: { select: { balance: true } },
    },
  });
  if (!user?.vault) throw new GameError(404, "NOT_FOUND", "Player not found.");
  const day = utcDay();
  const pack = readSlotsPack(user.rouletteDay, day);
  const cap = pack.cap > 0 ? pack.cap : liveCap(user, RULES.CASINO.SLOTS_CAP);
  const staked = pack.staked;
  return {
    cap,
    staked,
    locked: cap > 0 && staked >= cap,
    minBet: RULES.CASINO.SLOTS_MIN_BET,
    day,
    tries: triesView(pack),
  };
}

export async function spinSlots(userId: string, machineId: string, rawBet: number, fixed?: SlotSymbol[]) {
  const machine = slotMachine(machineId);
  if (!machine) throw new GameError(400, "BAD_MACHINE", "That cabinet is not on the floor.");
  const bet = Number(rawBet);
  if (!Number.isInteger(bet) || bet < RULES.CASINO.SLOTS_MIN_BET) {
    throw new GameError(400, "BAD_BET", `Minimum bet is ${RULES.CASINO.SLOTS_MIN_BET}.`);
  }

  const rolled = fixed?.length === 3
    ? { reels: fixed, win: evaluateSlots(machine, fixed) }
    : spinReels(machine, (max) => randomInt(0, max));
  const reels = rolled.reels;
  const win = rolled.win;
  const returned = win ? Math.round(bet * win.mult) : 0;
  const delta = returned - bet;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        cash: true,
        vaultCreditCard: true,
        reputationLevel: true,
        rouletteDay: true,
        vault: { select: { balance: true } },
      },
    });
    if (!user?.vault) throw new GameError(404, "NOT_FOUND", "Player not found.");
    const day = utcDay();
    const pack = readSlotsPack(user.rouletteDay, day);
    const cap = pack.cap > 0 ? pack.cap : liveCap(user, RULES.CASINO.SLOTS_CAP);
    const already = pack.staked;
    const limit = tryLimit(machineId);
    const usedTries = machineId === "sevens" ? pack.sevens : machineId === "vault" ? pack.vault : 0;
    if (limit > 0 && usedTries >= limit) {
      throw new GameError(409, "TRIES_USED", "That cabinet is done for today. It opens again at 12:00 GMT.");
    }
    if (cap <= 0 || already >= cap) {
      throw new GameError(409, "TABLE_CLOSED", "The day's allowance is spent. Come back tomorrow.");
    }
    if (already + bet > cap) {
      throw new GameError(400, "OVER_CAP", `That spin passes today's cap of ${cap}. ${cap - already} is left.`);
    }
    const card = Boolean(user.vaultCreditCard) || user.reputationLevel >= 11;
    const spendable = card ? user.vault.balance : user.cash;
    if (bet > spendable) {
      throw new GameError(
        400,
        "INSUFFICIENT_FUNDS",
        card ? "Not enough card balance in the vault." : "Not enough cash. Check your vault.",
      );
    }

    const winBit = returned > 0 ? SLOT_WIN_BIT[machineId] ?? 0 : 0;
    const next: SlotsPack = {
      ...pack,
      staked: already + bet,
      cap,
      sevens: pack.sevens + (machineId === "sevens" ? 1 : 0),
      vault: pack.vault + (machineId === "vault" ? 1 : 0),
      wins: pack.wins | winBit,
      sevensWins: pack.sevensWins + (machineId === "sevens" && returned > 0 ? 1 : 0),
    };
    const packed = writeCasinoDay(day, user.rouletteDay, next);
    if (card) {
      const paid = await tx.vault.updateMany({
        where: { userId, balance: { gte: bet } },
        data: { balance: { increment: delta } },
      });
      if (paid.count !== 1) {
        throw new GameError(400, "INSUFFICIENT_FUNDS", "Not enough card balance in the vault.");
      }
      await tx.user.update({ where: { id: userId }, data: { rouletteDay: packed } });
    } else {
      const paid = await tx.user.updateMany({
        where: { id: userId, cash: { gte: bet } },
        data: { cash: { increment: delta }, rouletteDay: packed },
      });
      if (paid.count !== 1) {
        throw new GameError(400, "INSUFFICIENT_FUNDS", "Not enough cash. Check your vault.");
      }
    }
    const staked = already + bet;
    return {
      machine: machine.id,
      reels,
      label: win?.label ?? null,
      stake: bet,
      returned,
      cash: card ? user.cash : user.cash + delta,
      cap,
      staked,
      locked: staked >= cap,
      tries: triesView(next),
      houseEdge: next.wins === 7 && pack.wins !== 7,
      hotHand: next.sevensWins >= 3 && pack.sevensWins < 3,
    };
  }, { maxWait: 4_000, timeout: 8_000 });
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
