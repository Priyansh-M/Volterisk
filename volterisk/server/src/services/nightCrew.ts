import { randomBytes } from "node:crypto";
import { RULES, vaultCapacity } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { createPlayer, ensureWeaponCatalog } from "./userService.js";

/**
 * Twenty stationed crews. They are heist targets and map markers, never players.
 * The first five can be robbed once per UTC day. The other fifteen, once per UTC week.
 * Sector ids match the client chart at step 22 (station marks in world.ts).
 */
export const NIGHT_CREW = [
  { username: "Mara Voss", cash: 4_000, vaultBalance: 18_000, vaultLevel: 1, cadence: "day" },
  { username: "Eddie Quill", cash: 3_000, vaultBalance: 22_000, vaultLevel: 1, cadence: "day" },
  { username: "Nia Pell", cash: 6_000, vaultBalance: 40_000, vaultLevel: 2, cadence: "day" },
  { username: "Hugo Brandt", cash: 5_000, vaultBalance: 28_000, vaultLevel: 1, cadence: "day" },
  { username: "Colette Marsh", cash: 8_000, vaultBalance: 55_000, vaultLevel: 2, cadence: "day" },
  { username: "Felix Dunn", cash: 12_000, vaultBalance: 80_000, vaultLevel: 3, cadence: "week" },
  { username: "Ruth Keene", cash: 2_000, vaultBalance: 16_000, vaultLevel: 1, cadence: "week" },
  { username: "Samir Odeh", cash: 20_000, vaultBalance: 120_000, vaultLevel: 4, cadence: "week" },
  { username: "Inez Calder", cash: 1_500, vaultBalance: 12_000, vaultLevel: 1, cadence: "week" },
  { username: "Paulie Tran", cash: 9_000, vaultBalance: 64_000, vaultLevel: 2, cadence: "week" },
  { username: "Wes Harlow", cash: 7_000, vaultBalance: 36_000, vaultLevel: 2, cadence: "week" },
  { username: "Lila Quinn", cash: 4_500, vaultBalance: 24_000, vaultLevel: 1, cadence: "week" },
  { username: "Otto Venn", cash: 11_000, vaultBalance: 90_000, vaultLevel: 3, cadence: "week" },
  { username: "Sera Lang", cash: 6_500, vaultBalance: 48_000, vaultLevel: 2, cadence: "week" },
  { username: "Mick Doyle", cash: 3_500, vaultBalance: 20_000, vaultLevel: 1, cadence: "week" },
  { username: "Anya Frost", cash: 14_000, vaultBalance: 110_000, vaultLevel: 4, cadence: "week" },
  { username: "Jules Peck", cash: 5_500, vaultBalance: 32_000, vaultLevel: 2, cadence: "week" },
  { username: "Nora Kim", cash: 8_500, vaultBalance: 70_000, vaultLevel: 3, cadence: "week" },
  { username: "Theo Marsh", cash: 4_200, vaultBalance: 26_000, vaultLevel: 1, cadence: "week" },
  { username: "Cora Bennett", cash: 10_000, vaultBalance: 84_000, vaultLevel: 3, cadence: "week" },
] as const;

export type NightCrewMember = (typeof NIGHT_CREW)[number];
export type NpcCadence = NightCrewMember["cadence"];

export const NPC_STATIONS = [
  { username: "Mara Voss", sectorId: "velmora-0001", landmassId: "velmora", regionName: "North Horn", cadence: "day" },
  { username: "Eddie Quill", sectorId: "velmora-0005", landmassId: "velmora", regionName: "West Reach", cadence: "day" },
  { username: "Nia Pell", sectorId: "velmora-0019", landmassId: "velmora", regionName: "North Horn", cadence: "day" },
  { username: "Hugo Brandt", sectorId: "velmora-0022", landmassId: "velmora", regionName: "West Reach", cadence: "day" },
  { username: "Colette Marsh", sectorId: "velmora-0036", landmassId: "velmora", regionName: "North Horn", cadence: "day" },
  { username: "Felix Dunn", sectorId: "velmora-0044", landmassId: "velmora", regionName: "North Horn", cadence: "week" },
  { username: "Ruth Keene", sectorId: "velmora-0068", landmassId: "velmora", regionName: "West Reach", cadence: "week" },
  { username: "Samir Odeh", sectorId: "velmora-0074", landmassId: "velmora", regionName: "East Bight", cadence: "week" },
  { username: "Inez Calder", sectorId: "velmora-0091", landmassId: "velmora", regionName: "East Bight", cadence: "week" },
  { username: "Paulie Tran", sectorId: "velmora-0094", landmassId: "velmora", regionName: "West Reach", cadence: "week" },
  { username: "Wes Harlow", sectorId: "velmora-0100", landmassId: "velmora", regionName: "Inner Shelf", cadence: "week" },
  { username: "Lila Quinn", sectorId: "velmora-0128", landmassId: "velmora", regionName: "Inner Shelf", cadence: "week" },
  { username: "Otto Venn", sectorId: "velmora-0134", landmassId: "velmora", regionName: "Inner Shelf", cadence: "week" },
  { username: "Sera Lang", sectorId: "velmora-0151", landmassId: "velmora", regionName: "East Bight", cadence: "week" },
  { username: "Mick Doyle", sectorId: "velmora-0157", landmassId: "velmora", regionName: "Inner Shelf", cadence: "week" },
  { username: "Anya Frost", sectorId: "velmora-0163", landmassId: "velmora", regionName: "Inner Shelf", cadence: "week" },
  { username: "Jules Peck", sectorId: "velmora-0177", landmassId: "velmora", regionName: "Inner Shelf", cadence: "week" },
  { username: "Nora Kim", sectorId: "velmora-0187", landmassId: "velmora", regionName: "Inner Shelf", cadence: "week" },
  { username: "Theo Marsh", sectorId: "velmora-0194", landmassId: "velmora", regionName: "South Keys", cadence: "week" },
  { username: "Cora Bennett", sectorId: "velmora-0206", landmassId: "velmora", regionName: "South Keys", cadence: "week" },
] as const;

const stationByName = new Map(NPC_STATIONS.map((station) => [station.username.toLowerCase(), station]));

export function stationForUsername(username: string) {
  return stationByName.get(username.trim().toLowerCase()) ?? null;
}

export function isStationedNpc(username: string): boolean {
  return stationByName.has(username.trim().toLowerCase());
}

/** UTC day or ISO week (Monday) start. A successful hit inside this window locks the crew. */
export function npcWindowStart(cadence: NpcCadence, now = new Date()): Date {
  if (cadence === "day") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return start;
}

/** Seed balance, lifted to the heist floor only when the roster itself is too thin. */
export function heistableVaultBalance(balance: number): number {
  return balance >= RULES.MIN_VAULT_BALANCE ? balance : RULES.MIN_VAULT_BALANCE;
}

let crewReady = false;

/**
 * Inserts any missing night-crew bots. Existing rows keep their cash and vault
 * so a restart does not undo a completed heist.
 */
export async function ensureNightCrew(): Promise<void> {
  if (process.env.VERCEL && crewReady) return;
  await ensureWeaponCatalog();
  const keys = NIGHT_CREW.map((bot) => bot.username.toLowerCase());
  const existing = await prisma.user.findMany({ where: { usernameKey: { in: keys } } });
  const byKey = new Map(existing.map((user) => [user.usernameKey, user]));
  for (const bot of NIGHT_CREW) {
    const usernameKey = bot.username.toLowerCase();
    const row = byKey.get(usernameKey);
    if (row) {
      if (!row.isBot) await prisma.user.update({ where: { id: row.id }, data: { isBot: true } });
      continue;
    }
    await createPlayer({
      username: bot.username,
      password: randomBytes(24).toString("hex"),
      isBot: true,
      cash: bot.cash,
      vaultBalance: heistableVaultBalance(bot.vaultBalance),
      vaultLevel: bot.vaultLevel,
    });
  }
  await ensureNpcStations();
  if (process.env.VERCEL) crewReady = true;
}

/** Plants the twenty roster squares. Moves a bot onto its square when that square is free. */
export async function ensureNpcStations(): Promise<void> {
  const keys = NPC_STATIONS.map((station) => station.username.toLowerCase());
  const users = await prisma.user.findMany({
    where: { usernameKey: { in: keys }, isBot: true },
    include: { base: true },
  });
  const byKey = new Map(users.map((user) => [user.usernameKey, user]));
  const sectors = await prisma.base.findMany({
    where: { sectorId: { in: NPC_STATIONS.map((station) => station.sectorId) } },
  });
  const bySector = new Map(sectors.map((base) => [base.sectorId, base]));
  for (const station of NPC_STATIONS) {
    const user = byKey.get(station.username.toLowerCase());
    if (!user) continue;
    const owned = user.base;
    if (owned?.sectorId === station.sectorId) continue;
    const taken = bySector.get(station.sectorId);
    if (taken && taken.userId !== user.id) continue;
    if (owned) {
      await prisma.base.update({
        where: { id: owned.id },
        data: {
          sectorId: station.sectorId,
          landmassId: station.landmassId,
          regionName: station.regionName,
        },
      });
      bySector.set(station.sectorId, {
        ...owned,
        sectorId: station.sectorId,
        landmassId: station.landmassId,
        regionName: station.regionName,
      });
      continue;
    }
    const created = await prisma.base.create({
      data: {
        userId: user.id,
        sectorId: station.sectorId,
        landmassId: station.landmassId,
        regionName: station.regionName,
      },
    });
    bySector.set(station.sectorId, created);
  }
}

/** One read for the week's purses, then inserts only the crews that are missing. */
export async function loadNpcPurses(
  attackerId: string,
  npcs: { id: string; username: string }[],
  attackerLevel: number,
) {
  const weekStart = npcWindowStart("week");
  const ids = npcs.map((npc) => npc.id);
  const existing = ids.length
    ? await prisma.npcPurse.findMany({ where: { attackerId, weekStart, npcId: { in: ids } } })
    : [];
  const byNpc = new Map(existing.map((row) => [row.npcId, row]));
  const missing = npcs.filter((npc) => !byNpc.has(npc.id));
  if (missing.length === 0) return byNpc;
  try {
    await prisma.npcPurse.createMany({
      data: missing.map((npc) => {
        const offer = npcOffer(attackerLevel, npc.username, weekStart);
        return {
          attackerId,
          npcId: npc.id,
          weekStart,
          balance: offer.defaultBalance,
          defaultBalance: offer.defaultBalance,
          vaultTier: offer.tier,
          vaultLevel: offer.vaultLevel,
        };
      }),
    });
  } catch {
    /* another request inserted the same week */
  }
  const created = await prisma.npcPurse.findMany({
    where: { attackerId, weekStart, npcId: { in: missing.map((npc) => npc.id) } },
  });
  for (const row of created) byNpc.set(row.npcId, row);
  return byNpc;
}

/** How many crews step up with the player. The rest stay on a level 1 standard vault. */
export function scaledNpcCount(level: number): number {
  if (level <= 1) return NIGHT_CREW.length;
  if (level === 2) return 15;
  if (level === 3) return 10;
  return Math.max(3, 13 - level);
}

const GATED_NPCS = new Set(["samir odeh", "anya frost"]);
const PINNED_HARD = ["Felix Dunn", "Samir Odeh", "Anya Frost"];

export function isNpcGated(username: string, attackerLevel: number): boolean {
  return GATED_NPCS.has(username.trim().toLowerCase()) && attackerLevel < 5;
}

function mix(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export type NpcOffer = {
  npcId: string;
  tier: "standard";
  vaultLevel: number;
  defaultBalance: number;
  locked: boolean;
};

/** Stable for the UTC week, the attacker, and their reputation level. */
export function npcOffer(attackerLevel: number, npcId: string, weekStart: Date): NpcOffer {
  const week = weekStart.toISOString();
  const rest = NIGHT_CREW.map((bot) => bot.username).filter((name) => !PINNED_HARD.includes(name));
  rest.sort((a, b) => mix(`${week}:${a}`) - mix(`${week}:${b}`));
  const scaled = new Set([...PINNED_HARD, ...rest].slice(0, scaledNpcCount(attackerLevel)));
  const roster = NIGHT_CREW.find((bot) => bot.username === npcId) ?? NIGHT_CREW[0];
  const stepped = scaled.has(roster.username);
  const hard = PINNED_HARD.includes(roster.username);
  const vaultLevel = !stepped ? 1 : hard ? 5 : 1 + Math.floor(mix(`${week}:${attackerLevel}:${roster.username}:level`) * 4);
  const capacity = Math.max(RULES.MIN_VAULT_BALANCE, vaultCapacity("standard", vaultLevel));
  const rolled = Math.max(
    RULES.MIN_VAULT_BALANCE,
    Math.floor(capacity * (0.45 + mix(`${week}:${attackerLevel}:${roster.username}:cash`) * 0.55)),
  );
  const defaultBalance = stepped ? rolled : Math.min(heistableVaultBalance(roster.vaultBalance), capacity);
  return {
    npcId: roster.username,
    tier: "standard",
    vaultLevel,
    defaultBalance,
    locked: isNpcGated(roster.username, attackerLevel),
  };
}

export async function openNpcPurse(attackerId: string, npcUserId: string, npcUsername: string, attackerLevel: number) {
  const weekStart = npcWindowStart("week");
  const existing = await prisma.npcPurse.findUnique({
    where: { attackerId_npcId_weekStart: { attackerId, npcId: npcUserId, weekStart } },
  });
  if (existing) return existing;
  const offer = npcOffer(attackerLevel, npcUsername, weekStart);
  try {
    return await prisma.npcPurse.create({
      data: {
        attackerId,
        npcId: npcUserId,
        weekStart,
        balance: offer.defaultBalance,
        defaultBalance: offer.defaultBalance,
        vaultTier: offer.tier,
        vaultLevel: offer.vaultLevel,
      },
    });
  } catch {
    const again = await prisma.npcPurse.findUnique({
      where: { attackerId_npcId_weekStart: { attackerId, npcId: npcUserId, weekStart } },
    });
    if (!again) throw new Error("NPC purse did not open.");
    return again;
  }
}
