import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";

const SOURCES = new Set(["contract_payout", "passive_payday", "reputation_reward", "achievement_claim", "insurance_payout"]);
const SINKS = new Set([
  "weapon_buy",
  "weapon_upgrade",
  "shop_buy",
  "camera_buy",
  "camera_upgrade",
  "vault_upgrade",
  "property_buy",
  "vehicle_buy",
  "asset_upgrade",
  "insurance_premium",
  "police_seizure",
]);

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export async function communityBoard() {
  const [players, heisted] = await Promise.all([
    prisma.user.findMany({
      where: { isBot: false },
      select: { createdAt: true, cash: true, vault: { select: { balance: true } } },
    }),
    prisma.heist.aggregate({ where: { success: true }, _sum: { amountStolen: true } }),
  ]);
  const registeredPlayers = players.length;
  const totalMoney = players.reduce((sum, user) => sum + user.cash + (user.vault?.balance ?? 0), 0);
  const totalHeisted = heisted._sum.amountStolen ?? 0;

  const txs = await prisma.transaction.findMany({
    orderBy: { createdAt: "asc" },
    select: { type: true, amount: true, createdAt: true },
  });
  const events: { t: number; d: number }[] = players.map((user) => ({
    t: user.createdAt.getTime(),
    d: RULES.STARTING_CASH + RULES.STARTING_VAULT_BALANCE,
  }));
  for (const row of txs) {
    if (SOURCES.has(row.type)) events.push({ t: row.createdAt.getTime(), d: row.amount });
    else if (SINKS.has(row.type)) events.push({ t: row.createdAt.getTime(), d: -row.amount });
  }
  events.sort((a, b) => a.t - b.t);

  const series: { at: string; totalMoney: number }[] = [];
  if (events.length === 0) {
    series.push({ at: new Date().toISOString(), totalMoney });
  } else {
    const start = events[0].t;
    const end = Date.now();
    let index = 0;
    let running = 0;
    for (let cursor = start; cursor <= end; cursor += THREE_DAYS) {
      while (index < events.length && events[index].t <= cursor) {
        running += events[index].d;
        index += 1;
      }
      series.push({ at: new Date(cursor).toISOString(), totalMoney: Math.max(0, running) });
    }
    while (index < events.length) {
      running += events[index].d;
      index += 1;
    }
    const last = series[series.length - 1];
    if (!last || end - new Date(last.at).getTime() > 60_000) {
      series.push({ at: new Date(end).toISOString(), totalMoney });
    } else {
      last.totalMoney = totalMoney;
    }
  }

  return { registeredPlayers, totalMoney, totalHeisted, series };
}
