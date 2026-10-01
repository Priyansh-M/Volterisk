import { prisma } from "../prisma.js";

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

let communityCache: { at: number; value: Awaited<ReturnType<typeof readCommunityBoard>> } | null = null;

export async function communityBoard() {
  if (process.env.VERCEL && communityCache && Date.now() - communityCache.at < 20_000) return communityCache.value;
  const value = await readCommunityBoard();
  if (process.env.VERCEL) communityCache = { at: Date.now(), value };
  return value;
}

async function readCommunityBoard() {
  const [players, heisted, snaps] = await Promise.all([
    prisma.user.findMany({
      where: { isBot: false },
      select: { cash: true, vault: { select: { balance: true } } },
    }),
    prisma.heist.aggregate({ where: { success: true }, _sum: { amountStolen: true } }),
    prisma.economySnapshot.findMany({ orderBy: { takenAt: "asc" } }),
  ]);
  const registeredPlayers = players.length;
  const totalMoney = players.reduce((sum, user) => sum + user.cash + (user.vault?.balance ?? 0), 0);
  const totalHeisted = heisted._sum.amountStolen ?? 0;
  const now = new Date();
  const latest = snaps[snaps.length - 1];
  let series = snaps.map((row) => ({ at: row.takenAt.toISOString(), totalMoney: row.totalMoney }));
  if (!latest || now.getTime() - latest.takenAt.getTime() >= THREE_DAYS) {
    const saved = await prisma.economySnapshot.create({
      data: { totalMoney, heisted: totalHeisted, players: registeredPlayers },
    });
    series = [...series, { at: saved.takenAt.toISOString(), totalMoney: saved.totalMoney }];
  } else if (series.length > 0) {
    series[series.length - 1] = { at: now.toISOString(), totalMoney };
  }
  if (series.length === 0) series = [{ at: now.toISOString(), totalMoney }];

  return { registeredPlayers, totalMoney, totalHeisted, series };
}
