/**
 * Every gameplay number lives on this object. Services must not hardcode them.
 *
 * Effective combat level
 * ----------------------
 * effectiveLevel = (weaponNumber - 1) * 3 + upgradeLevel
 *
 * Upgrade level is an integer from WEAPON_MIN_UPGRADE (1) through
 * WEAPON_MAX_UPGRADE (4). Weapon N at upgrade 1 matches weapon N-1 at
 * upgrade 4, because (N-1)*3+1 === (N-2)*3+4.
 *
 *   Rusty Crowbar (1) upgrade 1 → 1
 *   Rusty Crowbar (1) upgrade 4 → 4
 *   Lockpick Set  (2) upgrade 1 → 4
 *   Vault Breaker (5) upgrade 4 → 16
 *
 * That effective level is the weaponLevel passed into the success formula
 * in probability.ts. Vault level is the integer on the target vault (1–10).
 */
export const RULES = {
  MIN_VAULT_BALANCE: 10_000,
  TARGET_PROTECTION_HOURS: 12,
  HEIST_COOLDOWN_HOURS: 2,
  /** Hard ceiling is 10. rewards.ts clamps to this and never pays more. */
  HEIST_REWARD_PERCENT: 10,
  STARTING_CASH: 20_000,
  STARTING_VAULT_BALANCE: 25_000,
  STARTING_VAULT_LEVEL: 1,
  VAULT_MIN_LEVEL: 1,
  VAULT_MAX_LEVEL: 10,
  WEAPON_MIN_UPGRADE: 1,
  WEAPON_MAX_UPGRADE: 4,
  /** Player level = 1 + floor(successfulHeists / this). */
  PLAYER_HEISTS_PER_LEVEL: 3,
  /** Vault balance >= this (and still under fortune) is "heavy". Below it, if heistable, is "modest". */
  WEALTH_HEAVY_AT: 100_000,
  WEALTH_FORTUNE_AT: 500_000,
  WEAPONS: [
    { id: "weapon:0001", number: 1, name: "Rusty Crowbar" },
    { id: "weapon:0002", number: 2, name: "Lockpick Set" },
    { id: "weapon:0003", number: 3, name: "Advanced Drill" },
    { id: "weapon:0004", number: 4, name: "Thermal Cutter" },
    { id: "weapon:0005", number: 5, name: "Vault Breaker" },
  ],
  /**
   * Cash to buy a weapon the player does not own yet.
   * weapon:0001 is issued at signup and is not sold.
   * Players may only buy the next number up from the best weapon they own.
   */
  WEAPON_BUY_COSTS: {
    "weapon:0001": 0,
    "weapon:0002": 20_000,
    "weapon:0003": 80_000,
    "weapon:0004": 220_000,
    "weapon:0005": 650_000,
  } as Record<string, number>,
  /**
   * Cash to raise a weapon FROM this upgrade level to the next.
   * Keys are the current upgrade level (1, 2, or 3). Level 4 is the cap.
   */
  WEAPON_UPGRADE_COSTS: {
    "weapon:0001": { 1: 4_000, 2: 9_000, 3: 18_000 },
    "weapon:0002": { 1: 12_000, 2: 28_000, 3: 55_000 },
    "weapon:0003": { 1: 30_000, 2: 70_000, 3: 140_000 },
    "weapon:0004": { 1: 80_000, 2: 180_000, 3: 360_000 },
    "weapon:0005": { 1: 200_000, 2: 450_000, 3: 900_000 },
  } as Record<string, Record<number, number>>,
  /**
   * Cash to raise a vault FROM this level to the next.
   * 1→2 $25,000, 2→3 $75,000, 3→4 $200,000, then the same steep climb through level 10.
   */
  VAULT_UPGRADE_COSTS: {
    1: 25_000,
    2: 75_000,
    3: 200_000,
    4: 500_000,
    5: 1_250_000,
    6: 3_000_000,
    7: 7_500_000,
    8: 18_000_000,
    9: 45_000_000,
  } as Record<number, number>,
  /** Reputation titles. The highest entry a player's level reaches wins. */
  TITLES: [
    { minLevel: 1, title: "Street Operator" },
    { minLevel: 2, title: "Corner Fixer" },
    { minLevel: 3, title: "Night Courier" },
    { minLevel: 5, title: "Safehouse Broker" },
    { minLevel: 7, title: "Ward Lieutenant" },
    { minLevel: 10, title: "Vault Specialist" },
    { minLevel: 14, title: "Syndicate Captain" },
    { minLevel: 18, title: "Shadow Underboss" },
    { minLevel: 25, title: "Iron Hour Kingpin" },
  ] as { minLevel: number; title: string }[],
  /**
   * Public wealth bands. Net worth is only ever reported as one of these labels,
   * so an exact cash or vault figure never leaves the server for another player.
   */
  WEALTH_BANDS: [
    { under: 25_000, label: "Under $25K" },
    { under: 50_000, label: "$25K–$50K" },
    { under: 100_000, label: "$50K–$100K" },
    { under: 250_000, label: "$100K–$250K" },
    { under: 500_000, label: "$250K–$500K" },
    { under: 1_000_000, label: "$500K–$1M" },
    { under: 5_000_000, label: "$1M–$5M" },
    { under: 25_000_000, label: "$5M–$25M" },
  ] as { under: number; label: string }[],
  WEALTH_BAND_TOP_LABEL: "$25M+",
  /**
   * Territory. A sector id is an opaque map slug ("north-reach-07"); the server
   * only enforces shape and length so the map layer stays free to renumber.
   */
  SECTOR_ID_PATTERN: /^[a-z0-9]+(?:[-_.:][a-z0-9]+)*$/i,
  SECTOR_ID_MAX_LENGTH: 48,
  LANDMASS_ID_MAX_LENGTH: 48,
  REGION_NAME_MAX_LENGTH: 80,
  /** Work board: how many contracts are offered and how often the offer rotates. */
  WORK_BOARD_SIZE: 6,
  WORK_BOARD_ROTATION_MINUTES: 30,
  /** After collecting, that one contract is unavailable for this long. */
  WORK_CONTRACT_COOLDOWN_MINUTES: 10,
  /** The whole contract pool. Rewards and durations are never taken from the client. */
  WORK_CONTRACTS: [
    {
      id: "lookout-shift",
      name: "Lookout Shift",
      minLevel: 1,
      durationMinutes: 3,
      reward: 1_400,
      risk: "LOW",
      locationLabel: "Dock Row",
    },
    {
      id: "courier-run",
      name: "Courier Run",
      minLevel: 1,
      durationMinutes: 8,
      reward: 3_200,
      risk: "LOW",
      locationLabel: "Old Tram Line",
    },
    {
      id: "ledger-scrub",
      name: "Ledger Scrub",
      minLevel: 1,
      durationMinutes: 15,
      reward: 6_500,
      risk: "MEDIUM",
      locationLabel: "Copper Street Counting House",
    },
    {
      id: "night-unload",
      name: "Night Unload",
      minLevel: 1,
      durationMinutes: 25,
      reward: 11_000,
      risk: "MEDIUM",
      locationLabel: "Pier Fourteen",
    },
    {
      id: "plate-swap",
      name: "Plate Swap",
      minLevel: 1,
      durationMinutes: 12,
      reward: 5_000,
      risk: "LOW",
      locationLabel: "Marrow Lane Garage",
    },
    {
      id: "wire-tap",
      name: "Wire Tap",
      minLevel: 2,
      durationMinutes: 35,
      reward: 18_000,
      risk: "MEDIUM",
      locationLabel: "Exchange Basement",
    },
    {
      id: "bank-shadow",
      name: "Bank Shadow",
      minLevel: 3,
      durationMinutes: 50,
      reward: 32_000,
      risk: "HIGH",
      locationLabel: "Merchant Quarter",
    },
    {
      id: "customs-favour",
      name: "Customs Favour",
      minLevel: 4,
      durationMinutes: 70,
      reward: 55_000,
      risk: "HIGH",
      locationLabel: "Freeport Annex",
    },
    {
      id: "armoured-tail",
      name: "Armoured Tail",
      minLevel: 6,
      durationMinutes: 95,
      reward: 96_000,
      risk: "HIGH",
      locationLabel: "Ring Road North",
    },
    {
      id: "vault-survey",
      name: "Vault Survey",
      minLevel: 8,
      durationMinutes: 120,
      reward: 165_000,
      risk: "HIGH",
      locationLabel: "Iron Hour Depository",
    },
  ] as {
    id: string;
    name: string;
    minLevel: number;
    durationMinutes: number;
    reward: number;
    risk: "LOW" | "MEDIUM" | "HIGH";
    locationLabel: string;
  }[],
  /**
   * Properties are owned assets with a level and a storage capacity.
   * No passive income, no crews, no heat.
   */
  PROPERTY_MAX_LEVEL: 5,
  /** Capacity of a property = catalog capacity * level. */
  PROPERTY_CATALOG: [
    {
      catalogId: "property:safehouse",
      name: "Safehouse",
      kind: "SAFEHOUSE",
      price: 30_000,
      capacity: 2,
      description: "A rented flat with a reinforced door. Somewhere to keep the tools dry.",
    },
    {
      catalogId: "property:garage",
      name: "Lock-Up Garage",
      kind: "GARAGE",
      price: 75_000,
      capacity: 4,
      description: "Roll-down shutter on a quiet lane. Fits the heavy kit nobody should see.",
    },
    {
      catalogId: "property:warehouse",
      name: "Dock Warehouse",
      kind: "WAREHOUSE",
      price: 220_000,
      capacity: 8,
      description: "Cold, loud, and no questions asked past midnight.",
    },
    {
      catalogId: "property:workshop",
      name: "Machine Workshop",
      kind: "WORKSHOP",
      price: 480_000,
      capacity: 10,
      description: "Lathes, torches, and a night foreman who forgets faces.",
    },
    {
      catalogId: "property:penthouse",
      name: "River Penthouse",
      kind: "PENTHOUSE",
      price: 900_000,
      capacity: 12,
      description: "Above the smog, with a view of every bridge into the quarter.",
    },
  ] as {
    catalogId: string;
    name: string;
    kind: string;
    price: number;
    capacity: number;
    description: string;
  }[],
  /**
   * Cash to raise a property FROM this level to the next, as a multiple of the
   * catalog price. Level PROPERTY_MAX_LEVEL is the cap.
   */
  PROPERTY_UPGRADE_PRICE_MULTIPLIERS: {
    1: 0.6,
    2: 1.1,
    3: 1.9,
    4: 3.2,
  } as Record<number, number>,
};

export type WealthBucket = "modest" | "heavy" | "fortune";

export function effectiveWeaponLevel(weaponNumber: number, upgradeLevel: number): number {
  return (weaponNumber - 1) * 3 + upgradeLevel;
}

export function playerLevelFromHeists(successfulHeists: number): number {
  if (successfulHeists < 0) return 1;
  return 1 + Math.floor(successfulHeists / RULES.PLAYER_HEISTS_PER_LEVEL);
}

export function wealthBucket(balance: number): WealthBucket {
  if (balance >= RULES.WEALTH_FORTUNE_AT) return "fortune";
  if (balance >= RULES.WEALTH_HEAVY_AT) return "heavy";
  return "modest";
}

export function weaponById(id: string) {
  return RULES.WEAPONS.find((weapon) => weapon.id === id) ?? null;
}

/** Reputation title for a player level. Never a client-supplied value. */
export function titleForLevel(level: number): string {
  let title = RULES.TITLES[0].title;
  for (const entry of RULES.TITLES) {
    if (level >= entry.minLevel) title = entry.title;
  }
  return title;
}

/** Coarse public band for a net worth. Exact figures never leave the server. */
export function wealthBandLabel(netWorth: number): string {
  const value = Math.max(0, netWorth);
  for (const band of RULES.WEALTH_BANDS) {
    if (value < band.under) return band.label;
  }
  return RULES.WEALTH_BAND_TOP_LABEL;
}

export function workContractById(id: string) {
  return RULES.WORK_CONTRACTS.find((contract) => contract.id === id) ?? null;
}

export function workRequirementLabel(contract: { minLevel: number }): string {
  return contract.minLevel <= 1 ? "Open to all crews" : `Level ${contract.minLevel}+`;
}

export function propertyByCatalogId(catalogId: string) {
  return RULES.PROPERTY_CATALOG.find((entry) => entry.catalogId === catalogId) ?? null;
}

export function propertyCapacity(catalogCapacity: number, level: number): number {
  return catalogCapacity * level;
}

export function propertyUpgradeCost(price: number, level: number): number | null {
  if (level >= RULES.PROPERTY_MAX_LEVEL) return null;
  const multiplier = RULES.PROPERTY_UPGRADE_PRICE_MULTIPLIERS[level];
  if (multiplier === undefined) return null;
  return Math.round((price * multiplier) / 100) * 100;
}

export function minutesFromNow(minutes: number, from = new Date()): Date {
  return new Date(from.getTime() + minutes * 60 * 1000);
}

export function minutesAgo(minutes: number, from = new Date()): Date {
  return new Date(from.getTime() - minutes * 60 * 1000);
}

export function hoursFromNow(hours: number, from = new Date()): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function hoursAgo(hours: number, from = new Date()): Date {
  return new Date(from.getTime() - hours * 60 * 60 * 1000);
}
