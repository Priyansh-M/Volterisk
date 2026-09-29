/**
 * Every gameplay number lives on this object. Services must not hardcode them.
 *
 * Each weapon has four upgrade levels. Attack is the listed value for that
 * level, not a formula. Level 4 of a weapon sits one point under level 1 of
 * the next weapon in the line. Heists compare that attack to vault defense.
 * A purchase always creates a level 1 instance with its own durability.
 */
export const RULES = {
  MIN_VAULT_BALANCE: 10_000,
  TARGET_PROTECTION_HOURS: 12,
  /** Attacker lockout after any heist attempt. */
  HEIST_COOLDOWN_MINUTES: 15,
  /** Hard ceiling is 10. rewards.ts clamps to this and never pays more. */
  HEIST_REWARD_PERCENT: 10,
  STARTING_CASH: 1_000,
  STARTING_VAULT_BALANCE: 25_000,
  STARTING_VAULT_LEVEL: 1,
  VAULT_MIN_LEVEL: 1,
  VAULT_MAX_LEVEL: 5,
  WEAPON_MIN_UPGRADE: 1,
  WEAPON_MAX_UPGRADE: 4,
  /** Player level = 1 + floor(successfulHeists / this). */
  PLAYER_HEISTS_PER_LEVEL: 3,
  /** Vault balance >= this (and still under fortune) is "heavy". Below it, if heistable, is "modest". */
  WEALTH_HEAVY_AT: 100_000,
  WEALTH_FORTUNE_AT: 500_000,
  WEAPONS: [
    { id: "weapon:0001", number: 1, name: "Rusty Crowbar", type: "Breaching Tool", tier: 1, description: "Starter weapon. Cheap and reliable, relatively weak.", attacks: [10, 13, 16, 19], baseUses: 50 },
    { id: "weapon:0002", number: 2, name: "Glasswire Saw", type: "Filament Breach Tool", tier: 1.5, description: "A drawn wire that parts thin steel without a loud bite.", attacks: [20, 22, 25, 27], baseUses: 42 },
    { id: "weapon:0003", number: 3, name: "Pressure Spike", type: "Hydraulic Breach Tool", tier: 1.75, description: "A short hydraulic punch for stubborn door skins.", attacks: [28, 30, 33, 35], baseUses: 38 },
    { id: "weapon:0004", number: 4, name: "Lockpick Set", type: "Infiltration Tool", tier: 2, description: "Steadier against low and medium security vaults.", attacks: [36, 40, 44, 47], baseUses: 20 },
    { id: "weapon:0005", number: 5, name: "Ceramic Lance", type: "Precision Penetrator", tier: 2.5, description: "A hard ceramic point that finds the seam and stays there.", attacks: [48, 51, 54, 56], baseUses: 32 },
    { id: "weapon:0006", number: 6, name: "Pulse Ram", type: "Impact Breach System", tier: 2.75, description: "Timed impacts that walk a crack across the face of a door.", attacks: [57, 60, 63, 66], baseUses: 29 },
    { id: "weapon:0007", number: 7, name: "Advanced Drill", type: "Mechanical Breach", tier: 3, description: "High attack, and loud enough that the street notices.", attacks: [67, 71, 75, 79], baseUses: 25 },
    { id: "weapon:0008", number: 8, name: "Magnetic Shear", type: "Magnetic Breach System", tier: 3.5, description: "Opposed magnets that peel a plate instead of cutting it.", attacks: [80, 83, 86, 89], baseUses: 27 },
    { id: "weapon:0009", number: 9, name: "Resonance Driver", type: "Structural Resonance System", tier: 3.75, description: "Tunes the vault wall until the bolts give up.", attacks: [90, 93, 97, 100], baseUses: 25 },
    { id: "weapon:0010", number: 10, name: "Thermal Cutter", type: "High-Power Breach", tier: 4, description: "Cuts reinforced vaults that shrug off drills.", attacks: [101, 105, 110, 114], baseUses: 25 },
    { id: "weapon:0011", number: 11, name: "Induction Wedge", type: "Electromagnetic Breach System", tier: 4.5, description: "An expanding field that forces a gap the door cannot close.", attacks: [115, 118, 122, 126], baseUses: 23 },
    { id: "weapon:0012", number: 12, name: "Arc Fracture Unit", type: "Electrical Breach System", tier: 4.75, description: "A contained arc that fractures hardened alloys.", attacks: [127, 131, 135, 139], baseUses: 21 },
    { id: "weapon:0013", number: 13, name: "Vault Breaker", type: "Heavy Breaching System", tier: 5, description: "Built for high-security and rare vaults.", attacks: [140, 145, 150, 155], baseUses: 15 },
    { id: "weapon:0014", number: 14, name: "Graviton Press", type: "High-Pressure Compression System", tier: 5.5, description: "Crushes a locking stack until the pins no longer meet.", attacks: [156, 161, 166, 171], baseUses: 18 },
    { id: "weapon:0015", number: 15, name: "Seismic Lance", type: "Directed Seismic System", tier: 5.75, description: "A directed shock that travels through the vault instead of the door.", attacks: [172, 178, 184, 190], baseUses: 16 },
  ],
  /**
   * Cash to buy a weapon the player does not own yet.
   * weapon:0001 is issued at signup and is not sold.
   * Players may only buy the next number up from the best weapon they own.
   */
  WEAPON_BUY_COSTS: {
    "weapon:0001": 0,
    "weapon:0002": 5_000,
    "weapon:0003": 8_500,
    "weapon:0004": 12_000,
    "weapon:0005": 22_000,
    "weapon:0006": 32_000,
    "weapon:0007": 40_000,
    "weapon:0008": 75_000,
    "weapon:0009": 95_000,
    "weapon:0010": 125_000,
    "weapon:0011": 190_000,
    "weapon:0012": 240_000,
    "weapon:0013": 350_000,
    "weapon:0014": 500_000,
    "weapon:0015": 750_000,
  } as Record<string, number>,
  WEAPON_USES_PER_LEVEL: 5,
  /** Consumable. One use reveals the server chance for a single inspect. */
  ESTIMATE_PREDICTOR_COST: 1_000,
  ESTIMATE_PREDICTOR_ID: "estimate-predictor",
  /** Level 1 purchase. Each later upgrade is 1.5× the previous upgrade cost. */
  CAMERA_BASE_COST: 5_000,
  CAMERA_ID: "security-camera",
  CAMERA_MAX_LEVEL: 40,
  ACHIEVEMENTS: [
    { id: "first-steps", name: "First Steps", description: "Complete your first Work contract", reward: 2_000 },
    { id: "first-blood", name: "First Blood", description: "Complete your first successful heist", reward: 3_000 },
    { id: "armed-and-ready", name: "Armed and Ready", description: "Own 5 different weapon types", reward: 10_000 },
    { id: "growing-arsenal", name: "Growing Arsenal", description: "Own 10 different weapon types", reward: 50_000 },
    { id: "full-arsenal", name: "Full Arsenal", description: "Own all 15 weapon types", reward: 250_000 },
    { id: "inside-job", name: "Inside Job", description: "Successfully rob a player who recently interacted with you", reward: 50_000, sealed: true },
    { id: "against-the-odds", name: "Against the Odds", description: "Successfully complete a heist with a very low success probability", reward: 75_000, sealed: true },
    { id: "big-spender", name: "Big Spender", description: "Spend $1,000,000 on weapons, upgrades and equipment", reward: 50_000, sealed: true },
    { id: "paper-trail", name: "Paper Trail", description: "Accumulate 100 recorded transactions in your ledger", reward: 25_000, sealed: true },
    { id: "first-entry", name: "First Entry", description: "Establish your first operational base.", reward: 1_000 },
    { id: "clean-hands", name: "Clean Hands", description: "Complete 10 contracts without raising heat.", reward: 5_000 },
    { id: "false-bottom", name: "False Bottom", description: "Upgrade your vault to level 5.", reward: 5_000 },
    { id: "redacted", name: "Redacted", description: "Requirements remain classified.", reward: 5_000, sealed: true },
  ] as { id: string; name: string; description: string; reward: number; sealed?: boolean }[],
  /** Successful heists required before Redacted unlocks. The client never shows this number. */
  REDACTED_HEIST_GOAL: 15,
  CLEAN_HANDS_CONTRACTS: 10,
  /**
   * Cash to raise a weapon FROM this upgrade level to the next.
   * Keys are the current upgrade level (1, 2, or 3). Level 4 is the cap.
   */
  WEAPON_UPGRADE_COSTS: {
    "weapon:0001": { 1: 1_500, 2: 3_000, 3: 5_000 },
    "weapon:0002": { 1: 2_000, 2: 3_500, 3: 6_000 },
    "weapon:0003": { 1: 3_000, 2: 5_000, 3: 8_000 },
    "weapon:0004": { 1: 5_000, 2: 8_000, 3: 12_000 },
    "weapon:0005": { 1: 7_000, 2: 11_000, 3: 16_000 },
    "weapon:0006": { 1: 10_000, 2: 15_000, 3: 22_000 },
    "weapon:0007": { 1: 12_000, 2: 18_000, 3: 25_000 },
    "weapon:0008": { 1: 22_000, 2: 32_000, 3: 45_000 },
    "weapon:0009": { 1: 28_000, 2: 40_000, 3: 55_000 },
    "weapon:0010": { 1: 30_000, 2: 45_000, 3: 65_000 },
    "weapon:0011": { 1: 50_000, 2: 70_000, 3: 95_000 },
    "weapon:0012": { 1: 65_000, 2: 90_000, 3: 120_000 },
    "weapon:0013": { 1: 75_000, 2: 110_000, 3: 160_000 },
    "weapon:0014": { 1: 125_000, 2: 175_000, 3: 240_000 },
    "weapon:0015": { 1: 180_000, 2: 250_000, 3: 350_000 },
  } as Record<string, Record<number, number>>,
  /**
   * Cash to raise a vault FROM this level to the next.
   * 1→2 $25,000, 2→3 $75,000, 3→4 $200,000, then the same steep climb through level 10.
   */
  VAULT_TIERS: ["standard", "silver", "gold", "diamond"] as const,
  VAULT_TIER_LABEL: {
    standard: "Standard Vault",
    silver: "Silver Vault",
    gold: "Gold Vault",
    diamond: "Diamond Vault",
  } as Record<string, string>,
  /** Defense by tier, index 0 is level 1. */
  VAULT_DEFENSE: {
    standard: [10, 15, 20, 22, 24],
    silver: [32, 37, 42, 47, 52],
    gold: [60, 68, 76, 84, 85],
    diamond: [105, 109, 110, 111, 165],
  } as Record<string, number[]>,
  VAULT_CAPACITY: {
    standard: [50_000, 100_000, 250_000, 500_000, 1_000_000],
    silver: [1_500_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000],
    gold: [7_500_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000],
    diamond: [40_000_000, 55_000_000, 60_000_000, 65_000_000, 70_000_000],
  } as Record<string, number[]>,
  /** Percent of the balance a heist cannot touch. Level 1 standard is 0 so a fresh vault is fully exposed. */
  VAULT_SECURED_PERCENT: {
    standard: [0, 15, 25, 35, 45],
    silver: [50, 55, 60, 65, 70],
    gold: [72, 76, 80, 84, 88],
    diamond: [90, 92, 94, 96, 98],
  } as Record<string, number[]>,
  /** Cash to raise a vault one level inside the current tier. */
  VAULT_LEVEL_COSTS: {
    standard: { 1: 8_000, 2: 18_000, 3: 40_000, 4: 90_000 },
    silver: { 1: 120_000, 2: 200_000, 3: 320_000, 4: 480_000 },
    gold: { 1: 700_000, 2: 1_100_000, 3: 1_600_000, 4: 2_200_000 },
    diamond: { 1: 3_000_000, 2: 4_500_000, 3: 6_000_000, 4: 8_000_000 },
  } as Record<string, Record<number, number>>,
  VAULT_CONVERSION_COSTS: {
    standard: 250_000,
    silver: 1_500_000,
    gold: 10_000_000,
  } as Record<string, number>,
  INSURANCE_COVERAGE_PERCENT: 60,
  INSURANCE_PREMIUM: 4_000,
  INSURANCE_HOURS: 24,
  /** Reputation titles. The highest entry a player's level reaches wins. */
  TITLES: [
    { minLevel: 1, title: "Street Operator" },
    { minLevel: 2, title: "Corner Fixer" },
    { minLevel: 3, title: "Night Courier" },
    { minLevel: 4, title: "Block Captain" },
    { minLevel: 5, title: "Safehouse Broker" },
    { minLevel: 7, title: "Ward Lieutenant" },
    { minLevel: 10, title: "Vault Specialist" },
    { minLevel: 14, title: "Syndicate Captain" },
    { minLevel: 18, title: "Shadow Underboss" },
    { minLevel: 25, title: "Iron Hour Kingpin" },
  ] as { minLevel: number; title: string }[],
  /**
   * Reputation is the player level. Claiming a rung pays the reward and
   * raises the level that work and the dossier use. Everyone starts at 1.
   * Level 5 finishes every holding that the earlier rungs left short of level 5.
   */
  REPUTATION_MAX_LEVEL: 5,
  REPUTATION: [
    {
      level: 2,
      reward: 50_000,
      conditions: [
        { kind: "asset", id: "garage", minLevel: 1, label: "Buy a garage to keep your car" },
        { kind: "asset", id: "car", minLevel: 1, label: "Own your very first car" },
        { kind: "passive", label: "Find a passive income job" },
      ],
    },
    {
      level: 3,
      reward: 20_000,
      conditions: [
        { kind: "asset", id: "hangar", minLevel: 1, label: "Own a hangar so the aircraft has a home" },
        { kind: "asset", id: "airplane", minLevel: 1, label: "Own an airplane and put your name on it" },
        { kind: "asset", id: "garage", minLevel: 2, label: "Raise your garage to level 2" },
        { kind: "asset", id: "car", minLevel: 2, label: "Raise your car to level 2" },
        { kind: "asset", id: "bike", minLevel: 1, label: "Own a bike for the short runs" },
      ],
    },
    {
      level: 4,
      reward: 500_000,
      conditions: [
        { kind: "asset", id: "hangar", minLevel: 3, label: "Raise your hangar to level 3" },
        { kind: "asset", id: "airplane", minLevel: 3, label: "Raise your airplane to level 3" },
        { kind: "asset", id: "truck", minLevel: 1, label: "Own a truck that can carry a real load" },
        { kind: "asset", id: "bike", minLevel: 3, label: "Raise your bike to level 3" },
        { kind: "asset", id: "front", minLevel: 1, label: "Own a front business on the street" },
        { kind: "asset", id: "front", minLevel: 3, label: "Raise that front business to level 3" },
      ],
    },
    {
      level: 5,
      reward: 1_000_000,
      conditions: [
        { kind: "asset", id: "garage", minLevel: 5, label: "Raise your garage all the way to level 5" },
        { kind: "asset", id: "car", minLevel: 5, label: "Raise your car all the way to level 5" },
        { kind: "asset", id: "hangar", minLevel: 5, label: "Raise your hangar all the way to level 5" },
        { kind: "asset", id: "airplane", minLevel: 5, label: "Raise your airplane all the way to level 5" },
        { kind: "asset", id: "bike", minLevel: 5, label: "Raise your bike all the way to level 5" },
        { kind: "asset", id: "truck", minLevel: 5, label: "Raise your truck all the way to level 5" },
        { kind: "asset", id: "front", minLevel: 5, label: "Raise your front business all the way to level 5" },
        { kind: "asset", id: "safehouse", minLevel: 5, label: "Buy a safehouse and raise it to level 5" },
        { kind: "asset", id: "caravan", minLevel: 5, label: "Buy a caravan and raise it to level 5" },
        { kind: "asset", id: "warehouse", minLevel: 5, label: "Buy a warehouse and raise it to level 5" },
      ],
    },
  ] as {
    level: number;
    reward: number;
    conditions: { kind: "asset" | "passive"; id?: string; minLevel?: number; label: string }[];
  }[],
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
  WORK_CONTRACT_COOLDOWN_MINUTES: 24 * 60,
  /** After any active job is collected, the whole board waits this long. */
  WORK_GAP_MINUTES: 60,
  /** A failed heist leaves the attacker's vault unprotected for this long. */
  FAILED_HEIST_EXPOSURE_HOURS: 1,
  /** Against the Odds: a successful heist at or under this chance. */
  AGAINST_THE_ODDS_CHANCE: 20,
  /** Inside Job: the target must have crossed your ledger within this many days. */
  INSIDE_JOB_DAYS: 7,
  BIG_SPENDER_CENTS: 1_000_000,
  PAPER_TRAIL_COUNT: 100,
  LEADERBOARD_SIZE: 3,
  PASSIVE_JOBS: [
    { id: "volunteer", name: "Volunteer", payPerDay: 300, requires: [] },
    { id: "mail-man", name: "Mail Man", payPerDay: 450, requires: [] },
    { id: "package-runner", name: "Package Runner", payPerDay: 3_200, requires: [{ id: "bike", minLevel: 1 }] },
    { id: "street-lookout", name: "Street Lookout", payPerDay: 3_400, requires: [{ id: "safehouse", minLevel: 1 }] },
    { id: "shop-security", name: "Shop Security", payPerDay: 3_600, requires: [{ id: "safehouse", minLevel: 1 }] },
    { id: "warehouse-loader", name: "Warehouse Loader", payPerDay: 3_800, requires: [{ id: "warehouse", minLevel: 1 }] },
    { id: "document-runner", name: "Document Runner", payPerDay: 4_200, requires: [{ id: "safehouse", minLevel: 1 }, { id: "bike", minLevel: 1 }] },
    { id: "night-courier", name: "Night Courier", payPerDay: 4_500, requires: [{ id: "hangar", minLevel: 1 }, { id: "bike", minLevel: 1 }] },
    { id: "local-transport", name: "Local Transport", payPerDay: 4_800, requires: [{ id: "hangar", minLevel: 1 }, { anyVehicle: true, minLevel: 1 }] },
    { id: "cash-collection", name: "Cash Collection", payPerDay: 5_200, requires: [{ id: "front", minLevel: 1 }, { anyVehicle: true, minLevel: 1 }] },
    { id: "delivery-worker", name: "Delivery Worker", payPerDay: 5_500, requires: [{ id: "hangar", minLevel: 2 }, { id: "bike", minLevel: 1 }] },
    { id: "private-driver", name: "Private Driver", payPerDay: 6_000, requires: [{ id: "hangar", minLevel: 1 }, { id: "car", minLevel: 1 }] },
  ] as { id: string; name: string; payPerDay: number; requires: { id?: string; anyVehicle?: boolean; minLevel: number }[] }[],
  /** The whole contract pool. Rewards and durations are never taken from the client. */
  WORK_CONTRACTS: [
    {
      id: "street-sweep",
      name: "Street Sweep",
      minLevel: 1,
      durationMinutes: 5,
      reward: 1_000,
      risk: "LOW",
      locationLabel: "Copper Street",
    },
    {
      id: "parcel-drop",
      name: "Parcel Drop",
      minLevel: 1,
      durationMinutes: 10,
      reward: 1_200,
      risk: "LOW",
      locationLabel: "Dock Row",
    },
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
      minLevel: 5,
      durationMinutes: 95,
      reward: 96_000,
      risk: "HIGH",
      locationLabel: "Ring Road North",
    },
    {
      id: "vault-survey",
      name: "Vault Survey",
      minLevel: 5,
      durationMinutes: 120,
      reward: 165_000,
      risk: "HIGH",
      locationLabel: "Iron Hour Depository",
      difficulty: "ELITE",
      requiresProperty: "garage",
    },
  ] as {
    id: string;
    name: string;
    minLevel: number;
    durationMinutes: number;
    reward: number;
    risk: "LOW" | "MEDIUM" | "HIGH";
    locationLabel: string;
    difficulty?: "EASY" | "MODERATE" | "HARD" | "VERY HARD" | "ELITE";
    requiresProperty?: string;
  }[],
};

export type WealthBucket = "modest" | "heavy" | "fortune";

export type VaultTierName = (typeof RULES.VAULT_TIERS)[number];

export function attackPower(weaponNumber: number, upgradeLevel: number): number {
  const weapon = RULES.WEAPONS.find((entry) => entry.number === weaponNumber);
  const attacks = weapon?.attacks ?? [10];
  const index = Math.min(Math.max(upgradeLevel, 1), attacks.length) - 1;
  return attacks[index] ?? attacks[0];
}

/** Combat stat passed into heists. Same number as attack power for that level. */
export function effectiveWeaponLevel(weaponNumber: number, upgradeLevel: number): number {
  return attackPower(weaponNumber, upgradeLevel);
}

export function maxDurability(weaponId: string, upgradeLevel: number): number {
  const weapon = weaponById(weaponId);
  const base = weapon?.baseUses ?? 20;
  const steps = Math.max(0, upgradeLevel - 1);
  return base + steps * RULES.WEAPON_USES_PER_LEVEL;
}

function vaultIndex(level: number): number {
  return Math.min(Math.max(level, 1), RULES.VAULT_MAX_LEVEL) - 1;
}

export function vaultDefense(tier: string, level: number): number {
  const row = RULES.VAULT_DEFENSE[tier] ?? RULES.VAULT_DEFENSE.standard;
  return row[vaultIndex(level)] ?? row[0];
}

export function vaultCapacity(tier: string, level: number): number {
  const row = RULES.VAULT_CAPACITY[tier] ?? RULES.VAULT_CAPACITY.standard;
  return row[vaultIndex(level)] ?? row[0];
}

export function vaultSecuredPercent(tier: string, level: number): number {
  const row = RULES.VAULT_SECURED_PERCENT[tier] ?? RULES.VAULT_SECURED_PERCENT.standard;
  return row[vaultIndex(level)] ?? 0;
}

export function exposedBalance(balance: number, tier: string, level: number): number {
  const secured = Math.floor((Math.max(0, balance) * vaultSecuredPercent(tier, level)) / 100);
  return Math.max(0, balance - secured);
}

export function nextVaultTier(tier: string): VaultTierName | null {
  const index = RULES.VAULT_TIERS.indexOf(tier as VaultTierName);
  if (index < 0 || index >= RULES.VAULT_TIERS.length - 1) return null;
  return RULES.VAULT_TIERS[index + 1];
}

export function workDifficulty(contract: { risk: string; difficulty?: string }): string {
  if (contract.difficulty) return contract.difficulty;
  if (contract.risk === "LOW") return "EASY";
  if (contract.risk === "MEDIUM") return "MODERATE";
  return "HARD";
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

export function minutesFromNow(minutes: number, from = new Date()): Date {
  return new Date(from.getTime() + minutes * 60 * 1000);
}

export function minutesAgo(minutes: number, from = new Date()): Date {
  return new Date(from.getTime() - minutes * 60 * 1000);
}

/** Cost to raise an installed camera from `currentLevel` to the next level. Level 0 is the $5,000 buy. */
export function cameraUpgradeCost(currentLevel: number): number | null {
  if (currentLevel < 0 || currentLevel >= RULES.CAMERA_MAX_LEVEL) return null;
  let cost = RULES.CAMERA_BASE_COST;
  for (let step = 0; step < currentLevel; step += 1) {
    cost = Math.round(cost * 1.5);
  }
  return cost;
}

export function achievementById(id: string) {
  return RULES.ACHIEVEMENTS.find((entry) => entry.id === id) ?? null;
}

export function hoursFromNow(hours: number, from = new Date()): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function hoursAgo(hours: number, from = new Date()): Date {
  return new Date(from.getTime() - hours * 60 * 60 * 1000);
}
