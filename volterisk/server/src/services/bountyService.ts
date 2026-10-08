import { GameError } from "../game/errors.js";
import { prisma } from "../prisma.js";
import { creditCash, debitCash, type Tx } from "./economyService.js";
import { writeNotification } from "./notificationService.js";

const MIN_BOUNTY = 5_000;
const MIN_TARGET_VAULT = 20_000;
const ACTIVE = new Set(["open", "hunting"]);
export const BOUNTY_DURATIONS_HOURS = [24, 48, 72, 168] as const;

function present(
  row: {
    id: string;
    amount: number;
    funded: number;
    goal: number;
    stolenTotal: number;
    status: string;
    claimedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    posterId: string;
    targetId: string;
    poster: { id: string; username: string; avatarUrl: string | null };
    target: { id: string; username: string; avatarUrl: string | null; vault: { balance: number } | null };
    cuts?: { userId: string; stolen: number }[];
  },
  viewerId: string,
) {
  const goal = Math.max(1, row.goal || row.funded || row.amount);
  const funded = Math.max(row.funded, row.amount);
  const progress = Math.min(100, Math.floor((row.stolenTotal * 100) / goal));
  const youStarted = Boolean(row.cuts?.some((cut) => cut.userId === viewerId));
  const yourStolen = row.cuts?.find((cut) => cut.userId === viewerId)?.stolen ?? 0;
  return {
    id: row.id,
    amount: row.amount,
    funded,
    goal,
    stolenTotal: row.stolenTotal,
    progress,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    claimedAt: row.claimedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    poster: {
      id: row.poster.id,
      username: row.poster.username,
      avatarUrl: row.poster.avatarUrl,
    },
    target: {
      id: row.target.id,
      username: row.target.username,
      avatarUrl: row.target.avatarUrl,
      vaultEligible: (row.target.vault?.balance ?? 0) >= MIN_TARGET_VAULT,
    },
    youArePoster: row.posterId === viewerId,
    youAreTarget: row.targetId === viewerId,
    youStarted,
    yourStolen,
    canStart:
      ACTIVE.has(row.status) &&
      row.amount > 0 &&
      row.posterId !== viewerId &&
      row.targetId !== viewerId &&
      !youStarted,
    canHeist:
      ACTIVE.has(row.status) &&
      row.amount > 0 &&
      youStarted &&
      row.targetId !== viewerId,
    canFund: ACTIVE.has(row.status) && row.targetId !== viewerId && row.amount > 0,
    canCancel: ACTIVE.has(row.status) && row.posterId === viewerId,
    heistPath: `/heists?kind=player&player=${encodeURIComponent(row.target.username)}`,
  };
}

const include = {
  poster: { select: { id: true, username: true, avatarUrl: true } },
  target: { select: { id: true, username: true, avatarUrl: true, vault: { select: { balance: true } } } },
  cuts: { select: { userId: true, stolen: true } },
} as const;

async function settleCuts(
  tx: Tx,
  bounty: { id: string; amount: number; funded: number; goal: number; posterId: string },
  cuts: { id: string; userId: string; stolen: number; paid: number }[],
): Promise<number> {
  const goal = Math.max(1, bounty.goal || bounty.funded || bounty.amount);
  const funded = Math.max(1, bounty.funded || bounty.amount);
  let remaining = bounty.amount;
  let paidOut = 0;
  const earners = cuts.filter((cut) => cut.stolen > 0).sort((a, b) => b.stolen - a.stolen);
  for (let index = 0; index < earners.length; index += 1) {
    const cut = earners[index];
    const raw = Math.floor((cut.stolen * funded) / goal);
    const pay = Math.min(remaining, Math.max(0, raw - cut.paid));
    if (pay <= 0) continue;
    await creditCash(tx, cut.userId, pay);
    await tx.bountyCut.update({
      where: { id: cut.id },
      data: { paid: { increment: pay } },
    });
    await tx.transaction.create({
      data: {
        type: "bounty_payout",
        amount: pay,
        fromUserId: bounty.posterId,
        toUserId: cut.userId,
      },
    });
    remaining -= pay;
    paidOut += pay;
  }
  return paidOut;
}

async function refundFunders(
  tx: Tx,
  bounty: { id: string; amount: number; funded: number; posterId: string },
  funds: { userId: string; amount: number }[],
  remaining: number,
): Promise<void> {
  if (remaining <= 0) return;
  const rows =
    funds.length > 0 ? funds : [{ userId: bounty.posterId, amount: bounty.funded || remaining }];
  const funded = Math.max(
    1,
    rows.reduce((sum, fund) => sum + fund.amount, 0),
  );
  let paidBack = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const fund = rows[index];
    const share =
      index === rows.length - 1
        ? remaining - paidBack
        : Math.floor((fund.amount * remaining) / funded);
    if (share <= 0) continue;
    await creditCash(tx, fund.userId, share);
    await tx.transaction.create({
      data: { type: "bounty_cancel", amount: share, toUserId: fund.userId },
    });
    paidBack += share;
  }
}

/** Settle expired contracts once when the board is opened — no background timer. */
async function expireDueBounties(): Promise<void> {
  const now = new Date();
  const due = await prisma.bounty.findMany({
    where: { status: { in: [...ACTIVE] }, expiresAt: { lte: now } },
    select: { id: true },
    take: 20,
  });
  for (const row of due) {
    try {
      await endBounty(row.id, "expired");
    } catch {
      /* already settled by another request */
    }
  }
}

async function endBounty(bountyId: string, reason: "cancelled" | "expired"): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const row = await tx.bounty.findUnique({
      where: { id: bountyId },
      include: { funds: true, cuts: true },
    });
    if (!row || !ACTIVE.has(row.status)) return;
    const updated = await tx.bounty.updateMany({
      where: { id: bountyId, status: { in: [...ACTIVE] } },
      data: {
        status: reason === "expired" ? "expired" : "cancelled",
        cancelledAt: new Date(),
      },
    });
    if (updated.count !== 1) return;
    const paidOut = await settleCuts(tx, row, row.cuts);
    const remaining = Math.max(0, row.amount - paidOut);
    await refundFunders(tx, row, row.funds, remaining);
    await tx.bounty.update({ where: { id: bountyId }, data: { amount: 0 } });
  });
}

export async function listBounties(viewerId: string) {
  await expireDueBounties();
  const rows = await prisma.bounty.findMany({
    where: { status: { in: [...ACTIVE] }, amount: { gt: 0 } },
    include,
    orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
    take: 60,
  });
  return {
    bounties: rows.map((row) => present(row, viewerId)),
    rules: {
      minAmount: MIN_BOUNTY,
      minTargetVault: MIN_TARGET_VAULT,
      durationsHours: [...BOUNTY_DURATIONS_HOURS],
    },
  };
}

/** Post a new contract, or add cash to the open one on that mark (raises steal goal and reward together). */
export async function createBounty(
  posterId: string,
  targetUserId: string,
  amountRaw: number,
  durationHoursRaw: number = 24,
) {
  const amount = Math.trunc(Number(amountRaw));
  const durationHours = Math.trunc(Number(durationHoursRaw));
  if (!Number.isFinite(amount) || amount < MIN_BOUNTY) {
    throw new GameError(400, "BOUNTY_TOO_LOW", `Bounties start at $${MIN_BOUNTY.toLocaleString()}.`);
  }
  if (!(BOUNTY_DURATIONS_HOURS as readonly number[]).includes(durationHours)) {
    throw new GameError(400, "BAD_DURATION", "Pick 24, 48, 72 hours, or 1 week.");
  }
  if (targetUserId === posterId) {
    throw new GameError(400, "SELF_BOUNTY", "You cannot put a bounty on yourself.");
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      include: { vault: true },
    });
    if (!target || target.isBot) {
      throw new GameError(404, "NO_TARGET", "Only players can carry a bounty.");
    }
    if ((target.vault?.balance ?? 0) < MIN_TARGET_VAULT) {
      throw new GameError(
        400,
        "VAULT_TOO_THIN",
        `That mark needs at least $${MIN_TARGET_VAULT.toLocaleString()} in the vault.`,
      );
    }

    await debitCash(tx, posterId, amount);

    const existing = await tx.bounty.findFirst({
      where: { targetId: targetUserId, status: { in: [...ACTIVE] }, amount: { gt: 0 } },
      include,
    });

    if (existing) {
      await tx.bountyFund.create({
        data: { bountyId: existing.id, userId: posterId, amount },
      });
      const row = await tx.bounty.update({
        where: { id: existing.id },
        data: {
          amount: { increment: amount },
          funded: { increment: amount },
          goal: { increment: amount },
        },
        include,
      });
      await tx.transaction.create({
        data: { type: "bounty_fund", amount, fromUserId: posterId },
      });
      const cash = await tx.user.findUnique({ where: { id: posterId }, select: { cash: true } });
      return { bounty: present(row, posterId), cash: cash?.cash ?? 0, fundedExisting: true };
    }

    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    const row = await tx.bounty.create({
      data: {
        posterId,
        targetId: targetUserId,
        amount,
        funded: amount,
        goal: amount,
        stolenTotal: 0,
        status: "open",
        expiresAt,
      },
      include,
    });
    await tx.bountyFund.create({
      data: { bountyId: row.id, userId: posterId, amount },
    });
    await tx.transaction.create({
      data: { type: "bounty_post", amount, fromUserId: posterId },
    });
    await writeNotification(tx, {
      userId: targetUserId,
      title: "Bounty posted",
      body: JSON.stringify({ amount, by: row.poster.username, hours: durationHours }),
      severity: "WARNING",
    });
    const cash = await tx.user.findUnique({ where: { id: posterId }, select: { cash: true } });
    return { bounty: present(row, posterId), cash: cash?.cash ?? 0, fundedExisting: false };
  });
}

export async function fundBounty(userId: string, bountyId: string, amountRaw: number) {
  const amount = Math.trunc(Number(amountRaw));
  if (!Number.isFinite(amount) || amount < MIN_BOUNTY) {
    throw new GameError(400, "BOUNTY_TOO_LOW", `Top-ups start at $${MIN_BOUNTY.toLocaleString()}.`);
  }
  return prisma.$transaction(async (tx) => {
    const row = await tx.bounty.findUnique({ where: { id: bountyId }, include });
    if (!row || !ACTIVE.has(row.status) || row.amount <= 0) {
      throw new GameError(404, "NO_BOUNTY", "That contract is gone.");
    }
    if (row.targetId === userId) {
      throw new GameError(400, "SELF_BOUNTY", "You cannot fund a bounty on yourself.");
    }
    await debitCash(tx, userId, amount);
    await tx.bountyFund.create({ data: { bountyId, userId, amount } });
    const next = await tx.bounty.update({
      where: { id: bountyId },
      data: {
        amount: { increment: amount },
        funded: { increment: amount },
        goal: { increment: amount },
      },
      include,
    });
    await tx.transaction.create({
      data: { type: "bounty_fund", amount, fromUserId: userId },
    });
    const cash = await tx.user.findUnique({ where: { id: userId }, select: { cash: true } });
    return { bounty: present(next, userId), cash: cash?.cash ?? 0 };
  });
}

/** Enroll as a hunter. Only after Start do heists count toward this bounty. */
export async function startBounty(hunterId: string, bountyId: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.bounty.findUnique({ where: { id: bountyId }, include });
    if (!row || !ACTIVE.has(row.status) || row.amount <= 0) {
      throw new GameError(404, "NO_BOUNTY", "That contract is gone.");
    }
    if (row.posterId === hunterId) {
      throw new GameError(400, "OWN_BOUNTY", "You posted this contract. You cannot hunt it.");
    }
    if (row.targetId === hunterId) {
      throw new GameError(400, "SELF_HUNT", "You are the mark on this contract.");
    }
    if ((row.target.vault?.balance ?? 0) < MIN_TARGET_VAULT) {
      throw new GameError(
        409,
        "VAULT_TOO_THIN",
        `That mark needs at least $${MIN_TARGET_VAULT.toLocaleString()} in the vault to start.`,
      );
    }

    const existing = await tx.bountyCut.findUnique({
      where: { bountyId_userId: { bountyId, userId: hunterId } },
    });
    if (existing) {
      throw new GameError(409, "ALREADY_STARTED", "You already started this contract. Heist the mark.");
    }

    await tx.bountyCut.create({
      data: { bountyId, userId: hunterId, stolen: 0, paid: 0 },
    });
    if (row.status === "open") {
      await tx.bounty.update({
        where: { id: bountyId },
        data: { status: "hunting", huntStartedAt: new Date(), hunterId },
      });
    }
    const next = await tx.bounty.findUniqueOrThrow({ where: { id: bountyId }, include });
    return {
      bounty: present(next, hunterId),
      heistPath: `/heists?kind=player&player=${encodeURIComponent(next.target.username)}`,
    };
  });
}

/**
 * Record a heist contribution only if the attacker has Started this bounty.
 * No cash from the pool until the bounty is fulfilled or cancelled.
 */
export async function noteBountyHeist(
  tx: Tx,
  hunterId: string,
  targetId: string,
  _heistId: string,
  amountStolen: number,
): Promise<number> {
  if (amountStolen <= 0) return 0;
  const open = await tx.bounty.findMany({
    where: { targetId, status: { in: [...ACTIVE] }, amount: { gt: 0 } },
    include: { cuts: true },
  });
  for (const bounty of open) {
    const cut = bounty.cuts.find((row) => row.userId === hunterId);
    if (!cut) continue;

    await tx.bountyCut.update({
      where: { id: cut.id },
      data: { stolen: { increment: amountStolen } },
    });
    const stolenTotal = bounty.stolenTotal + amountStolen;
    const goal = Math.max(1, bounty.goal || bounty.funded || bounty.amount);

    await tx.bounty.update({
      where: { id: bounty.id },
      data: { stolenTotal, status: "hunting" },
    });

    if (stolenTotal >= goal) {
      await completeBounty(tx, bounty.id, stolenTotal);
    }
  }
  return 0;
}

async function completeBounty(tx: Tx, bountyId: string, stolenTotal: number): Promise<void> {
  const bounty = await tx.bounty.findUniqueOrThrow({
    where: { id: bountyId },
    include: { cuts: true },
  });
  if (!ACTIVE.has(bounty.status) && bounty.status !== "hunting") {
    /* already settled */
  }
  const paidOut = await settleCuts(tx, bounty, bounty.cuts);
  const leftover = Math.max(0, bounty.amount - paidOut);
  if (leftover > 0) {
    await creditCash(tx, bounty.posterId, leftover);
    await tx.transaction.create({
      data: { type: "bounty_leftover", amount: leftover, toUserId: bounty.posterId },
    });
  }
  await tx.bounty.update({
    where: { id: bountyId },
    data: {
      amount: 0,
      stolenTotal,
      status: "completed",
      claimedAt: new Date(),
    },
  });
}

export async function claimBounty(_hunterId: string, _bountyId: string) {
  throw new GameError(
    409,
    "SETTLES_LATER",
    "Bounty cuts pay out when the steal goal is met or the poster cancels.",
  );
}

export async function cancelBounty(posterId: string, bountyId: string) {
  const row = await prisma.bounty.findUnique({ where: { id: bountyId }, include });
  if (!row) throw new GameError(404, "NO_BOUNTY", "That contract is gone.");
  if (row.posterId !== posterId) {
    throw new GameError(403, "NOT_POSTER", "Only the original poster can cancel this contract.");
  }
  if (!ACTIVE.has(row.status)) {
    throw new GameError(409, "NOT_OPEN", "That contract cannot be cancelled.");
  }
  await endBounty(bountyId, "cancelled");
  const cash = await prisma.user.findUnique({ where: { id: posterId }, select: { cash: true } });
  const next = await prisma.bounty.findUniqueOrThrow({ where: { id: bountyId }, include });
  return { bounty: present(next, posterId), cash: cash?.cash ?? 0 };
}

export async function searchBountyTargets(viewerId: string, raw: string) {
  const q = raw.trim();
  if (q.length < 1) return [];
  const rows = await prisma.user.findMany({
    where: {
      isBot: false,
      id: { not: viewerId },
      usernameKey: { contains: q.toLowerCase() },
      vault: { balance: { gte: MIN_TARGET_VAULT } },
    },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      vault: { select: { balance: true } },
    },
    take: 8,
    orderBy: { username: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    avatarUrl: row.avatarUrl,
    vaultBalance: row.vault?.balance ?? 0,
  }));
}
