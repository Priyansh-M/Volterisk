import { randomBytes } from "node:crypto";
import { npcTakeWindow } from "../game/npcPayout.js";
import { RULES, vaultCapacity, vaultModSlotsForLevel } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { createPlayer, ensureWeaponCatalog } from "./userService.js";

export { npcPayoutBand, npcTakeWindow } from "../game/npcPayout.js";

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
  { username: "Samir Odeh", cash: 20_000, vaultBalance: 1_800_000, vaultLevel: 3, cadence: "week" },
  { username: "Inez Calder", cash: 1_500, vaultBalance: 12_000, vaultLevel: 1, cadence: "week" },
  { username: "Paulie Tran", cash: 9_000, vaultBalance: 64_000, vaultLevel: 2, cadence: "week" },
  { username: "Wes Harlow", cash: 7_000, vaultBalance: 36_000, vaultLevel: 2, cadence: "week" },
  { username: "Lila Quinn", cash: 4_500, vaultBalance: 24_000, vaultLevel: 1, cadence: "week" },
  { username: "Otto Venn", cash: 11_000, vaultBalance: 90_000, vaultLevel: 3, cadence: "week" },
  { username: "Sera Lang", cash: 6_500, vaultBalance: 48_000, vaultLevel: 2, cadence: "week" },
  { username: "Mick Doyle", cash: 3_500, vaultBalance: 20_000, vaultLevel: 1, cadence: "week" },
  { username: "Anya Frost", cash: 14_000, vaultBalance: 1_600_000, vaultLevel: 3, cadence: "week" },
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
  if (crewReady) return;
  await ensureWeaponCatalog();
  const keys = NIGHT_CREW.map((bot) => bot.username.toLowerCase());
  const existing = await prisma.user.findMany({
    where: { usernameKey: { in: keys } },
    select: { id: true, usernameKey: true, isBot: true },
  });
  // Production already has the roster — skip inserts + station reshuffles on every cold start.
  if (existing.length >= keys.length) {
    const stationIds = NPC_STATIONS.map((s) => s.sectorId);
    const stationed = await prisma.base.count({ where: { sectorId: { in: stationIds } } });
    if (stationed >= stationIds.length) {
      crewReady = true;
      return;
    }
  }
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
  crewReady = true;
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

/** Raise an existing purse when the attacker levels up. Never shrink mid-week. */
async function upgradePurseIfNeeded(
  purse: {
    id: string;
    attackerId: string;
    npcId: string;
    weekStart: Date;
    balance: number;
    defaultBalance: number;
    vaultTier: string;
    vaultLevel: number;
  },
  offer: NpcOffer,
) {
  const betterTier = offer.tier === "diamond" && purse.vaultTier !== "diamond";
  const betterLevel = offer.vaultLevel > purse.vaultLevel;
  const betterDefault = offer.defaultBalance > purse.defaultBalance;
  if (!betterTier && !betterLevel && !betterDefault) return purse;
  const boost = Math.max(0, offer.defaultBalance - purse.defaultBalance);
  return prisma.npcPurse.update({
    where: { id: purse.id },
    data: {
      vaultTier: betterTier ? offer.tier : purse.vaultTier,
      vaultLevel: Math.max(purse.vaultLevel, offer.vaultLevel),
      defaultBalance: Math.max(purse.defaultBalance, offer.defaultBalance),
      balance: purse.balance + boost,
    },
  });
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
  if (missing.length > 0) {
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
  }
  await Promise.all(
    npcs.map(async (npc) => {
      const purse = byNpc.get(npc.id);
      if (!purse) return;
      const offer = npcOffer(attackerLevel, npc.username, weekStart);
      const updated = await upgradePurseIfNeeded(purse, offer);
      byNpc.set(npc.id, updated);
    }),
  );
  return byNpc;
}

/** Always open. Hard defense comes from their diamond vault, not a level gate. */
const DIAMOND_HARD = new Set(["samir odeh", "anya frost"]);

/**
 * NPC progression bands (4 crews each). Tier 0 matches the attacker’s reputation;
 * each next band is 2 clearance levels behind (L−2, L−4, …).
 * Tier 0 also uses a 3h personal cooldown; others keep the global 2h NPC cooldown.
 */
export const NPC_PROGRESSION_TIERS = [
  ["Mara Voss", "Colette Marsh", "Felix Dunn", "Nora Kim"],
  ["Eddie Quill", "Nia Pell", "Hugo Brandt", "Paulie Tran"],
  ["Wes Harlow", "Otto Venn", "Sera Lang", "Cora Bennett"],
  ["Lila Quinn", "Jules Peck", "Mick Doyle", "Theo Marsh"],
  ["Ruth Keene", "Inez Calder", "Samir Odeh", "Anya Frost"],
] as const;

/** @deprecated use NPC_PROGRESSION_TIERS[0] — kept for any older imports */
export const SCALING_NPCS = NPC_PROGRESSION_TIERS[0];

const TIER_BY_NAME = new Map<string, number>();
for (let t = 0; t < NPC_PROGRESSION_TIERS.length; t += 1) {
  for (const name of NPC_PROGRESSION_TIERS[t]!) {
    TIER_BY_NAME.set(name.toLowerCase(), t);
  }
}

export function isNpcGated(_username: string, _attackerLevel: number): boolean {
  return false;
}

export function isDiamondHardNpc(username: string): boolean {
  return DIAMOND_HARD.has(username.trim().toLowerCase());
}

export function npcTierIndex(username: string): number {
  return TIER_BY_NAME.get(username.trim().toLowerCase()) ?? NPC_PROGRESSION_TIERS.length - 1;
}

/** Effective clearance / power level for this crew vs the attacker. */
export function npcEffectiveLevel(username: string, attackerLevel: number): number {
  return Math.max(1, attackerLevel - npcTierIndex(username) * 2);
}

export function isScalingNpc(username: string): boolean {
  return npcTierIndex(username) === 0;
}

/** Minutes before this attacker may hit the same crew again. Tier 0 = 3h. */
export function npcCooldownMinutes(username: string): number {
  return npcTierIndex(username) === 0 ? 180 : RULES.NPC_COOLDOWN_MINUTES;
}

/**
 * Extra NPC defense once the attacker is past reputation 10.
 * +10 per player level above 10 (same for every crew). Stacks with NPC_DEFENSE_FLAT.
 */
export function npcLevelDefenseBonus(attackerLevel: number): number {
  if (attackerLevel <= RULES.NPC_DEFENSE_LEVEL_START) return 0;
  return (attackerLevel - RULES.NPC_DEFENSE_LEVEL_START) * RULES.NPC_DEFENSE_PER_LEVEL;
}

/** Total flat NPC defense bump: base flat + post-L10 scaling. */
export function npcDefenseBonus(attackerLevel: number): number {
  return RULES.NPC_DEFENSE_FLAT + npcLevelDefenseBonus(attackerLevel);
}

export function maxNpcCooldownMinutes(): number {
  return 180;
}

/**
 * Draft vault balances for an “average” player at a reputation rung.
 * Used as the purse target so estimated wealth tracks the ladder (pre-L10).
 */
export function averagePlayerVaultBalance(level: number): number {
  const L = Math.max(1, Math.floor(level));
  const table: Record<number, number> = {
    1: 28_000,
    2: 55_000,
    3: 95_000,
    4: 180_000,
    5: 400_000,
    6: 750_000,
    7: 1_200_000,
    8: 2_000_000,
    9: 3_500_000,
    10: 6_000_000,
    11: 10_000_000,
    12: 14_000_000,
    13: 18_000_000,
    14: 24_000_000,
    15: 32_000_000,
    20: 55_000_000,
    25: 90_000_000,
    30: 140_000_000,
    35: 220_000_000,
    40: 350_000_000,
    45: 500_000_000,
    50: 750_000_000,
  };
  if (table[L] != null) return table[L]!;
  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  let lo = keys[0]!;
  let hi = keys[keys.length - 1]!;
  for (const k of keys) {
    if (k <= L) lo = k;
    if (k >= L) {
      hi = k;
      break;
    }
  }
  if (lo === hi) return table[lo]!;
  const t = (L - lo) / (hi - lo);
  return Math.floor(table[lo]! + (table[hi]! - table[lo]!) * t);
}

/** Vault tier/level appropriate for a clearance rung (harder doors as level rises). */
export function vaultForEffectiveLevel(effectiveLevel: number): { tier: string; vaultLevel: number } {
  const level = Math.max(1, effectiveLevel);
  if (level >= 25) return { tier: "diamond", vaultLevel: Math.min(5, 3 + Math.floor((level - 25) / 5)) };
  if (level >= 15) return { tier: "gold", vaultLevel: Math.min(5, 2 + Math.floor((level - 15) / 2)) };
  if (level >= 8) return { tier: "silver", vaultLevel: Math.min(5, 1 + Math.floor((level - 8) / 2)) };
  return { tier: "standard", vaultLevel: Math.min(5, Math.max(1, level)) };
}

/** Synthetic vault mods for NPC purses once clearance ≥ 15 (slot-capped). */
export function npcVaultModsForLevel(effectiveLevel: number): string[] {
  if (effectiveLevel < 15) return [];
  const pool: { min: number; id: string }[] = [
    { min: 15, id: "reinforced-vault-panels" },
    { min: 18, id: "motion-detection-grid" },
    { min: 20, id: "access-control-system" },
    { min: 25, id: "layered-barrier-system" },
    { min: 28, id: "adaptive-security-network" },
    { min: 30, id: "thermal-signature-masking" },
    { min: 32, id: "automated-countermeasures" },
    { min: 35, id: "aegis-defence-core" },
    { min: 40, id: "predictive-security-matrix" },
    { min: 45, id: "distributed-barrier-network" },
  ];
  const slots = vaultModSlotsForLevel(effectiveLevel);
  return pool
    .filter((row) => effectiveLevel >= row.min)
    .map((row) => row.id)
    .slice(0, Math.max(0, slots));
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
  tier: string;
  vaultLevel: number;
  defaultBalance: number;
  clearanceLevel: number;
  modIds: string[];
  cooldownMinutes: number;
  locked: boolean;
};

/**
 * Stable for the UTC week at a given reputation.
 * Clearance drives vault tier/defense. At L10+ the purse is sized to the
 * absolute take band (so 1–15% rolls land in the designed dollar window);
 * pre-L10 still tracks average-player wealth.
 */
export function npcOffer(attackerLevel: number, npcId: string, weekStart: Date): NpcOffer {
  const week = weekStart.toISOString();
  const roster = NIGHT_CREW.find((bot) => bot.username === npcId) ?? NIGHT_CREW[0];
  const clearanceLevel = npcEffectiveLevel(roster.username, attackerLevel);
  const diamond = DIAMOND_HARD.has(roster.username.toLowerCase());

  let tier: string;
  let vaultLevel: number;
  if (diamond) {
    tier = "diamond";
    vaultLevel = Math.min(5, Math.max(3, 2 + Math.floor(clearanceLevel / 3)));
  } else {
    ({ tier, vaultLevel } = vaultForEffectiveLevel(clearanceLevel));
  }

  const takeWin = npcTakeWindow(
    attackerLevel,
    npcTierIndex(roster.username),
    DIAMOND_HARD.has(roster.username.toLowerCase()),
  );
  let defaultBalance: number;
  if (takeWin) {
    // Purse sized so a mid take fits the window; vault defense still from tier/level.
    const midTake = (takeWin.min + takeWin.max) / 2;
    const jitter = 0.92 + mix(`${week}:${attackerLevel}:${roster.username}:band`) * 0.16;
    defaultBalance = Math.max(
      RULES.MIN_VAULT_BALANCE,
      Math.floor((midTake / 0.08) * jitter),
    );
  } else {
    const avg = averagePlayerVaultBalance(clearanceLevel);
    const jitter = 0.88 + mix(`${week}:${clearanceLevel}:${roster.username}:cash`) * 0.24;
    defaultBalance = Math.max(RULES.MIN_VAULT_BALANCE, Math.floor(avg * jitter));
    if (diamond) defaultBalance = Math.floor(defaultBalance * 1.35);
  }

  return {
    npcId: roster.username,
    tier,
    vaultLevel,
    defaultBalance,
    clearanceLevel,
    modIds: npcVaultModsForLevel(clearanceLevel),
    cooldownMinutes: npcCooldownMinutes(roster.username),
    locked: false,
  };
}

export async function openNpcPurse(attackerId: string, npcUserId: string, npcUsername: string, attackerLevel: number) {
  const weekStart = npcWindowStart("week");
  const existing = await prisma.npcPurse.findUnique({
    where: { attackerId_npcId_weekStart: { attackerId, npcId: npcUserId, weekStart } },
  });
  const offer = npcOffer(attackerLevel, npcUsername, weekStart);
  if (existing) return upgradePurseIfNeeded(existing, offer);
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
    return upgradePurseIfNeeded(again, offer);
  }
}
