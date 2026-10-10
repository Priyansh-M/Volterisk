import { buildLateReputation } from "./lateReputation.js";

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
  TARGET_PROTECTION_HOURS: 2,
  /** Attacker lockout after any heist attempt. */
  HEIST_COOLDOWN_MINUTES: 15,
  /** Per crew. A player can hit a different crew while this one is cooling. No vault penalty. */
  NPC_COOLDOWN_MINUTES: 120,
  /** Flat defense added on every stationed-crew vault. */
  NPC_DEFENSE_FLAT: 6,
  /**
   * After reputation 10, each NPC gets +10 defense per player level above 10
   * (L11 → +10, L12 → +20, …) on top of NPC_DEFENSE_FLAT.
   */
  NPC_DEFENSE_LEVEL_START: 10,
  NPC_DEFENSE_PER_LEVEL: 10,
  /** Pre–reputation 10: NPC take is this percent band of the purse. */
  NPC_STEAL_PERCENT_MIN: 1,
  NPC_STEAL_PERCENT_MAX: 15,
  /**
   * Reputation 10+: absolute NPC take bands (dollars). Tier 0 sits high in the band;
   * tier 4 sits low. Inclusive [from, to) on attacker reputation except the last band.
   */
  NPC_PAYOUT_BANDS: [
    { from: 10, to: 15, min: 1_000, max: 25_000 },
    { from: 15, to: 20, min: 3_000, max: 27_000 },
    { from: 20, to: 25, min: 5_000, max: 33_000 },
    { from: 25, to: 30, min: 7_000, max: 35_000 },
    { from: 30, to: 35, min: 10_000, max: 37_000 },
    { from: 35, to: 40, min: 10_000, max: 40_000 },
    { from: 40, to: 51, min: 10_000, max: 42_000 },
  ] as { from: number; to: number; min: number; max: number }[],
  /**
   * Max asset level required by reputation rungs ≤ 10. Upgrades past these
   * add POST_L10_UPGRADE_BASE + steps × POST_L10_UPGRADE_STEP (Manufacturing Plant excluded).
   */
  L10_ASSET_LEVEL_BASELINE: {
    garage: 10,
    car: 10,
    hangar: 10,
    airplane: 10,
    truck: 10,
    bike: 8,
    front: 7,
    warehouse: 8,
    safehouse: 5,
    caravan: 5,
    dock: 5,
    speedboat: 5,
    helipad: 5,
    helicopter: 5,
    "chop-shop": 5,
    "armored-van": 5,
    casino: 3,
    limousine: 3,
    estate: 1,
    yacht: 1,
  } as Record<string, number>,
  POST_L10_UPGRADE_BASE: 200_000,
  POST_L10_UPGRADE_STEP: 50_000,
  /** Player heist cash take — usual inclusive percent band of the full vault. */
  PLAYER_STEAL_PERCENT_MIN: 1,
  PLAYER_STEAL_PERCENT_MAX: 15,
  /** Chance (percent) that a player hit rolls the jackpot band instead. */
  PLAYER_STEAL_JACKPOT_CHANCE: 4,
  /** Inclusive jackpot percent band of the full vault. */
  PLAYER_STEAL_JACKPOT_MIN: 35,
  PLAYER_STEAL_JACKPOT_MAX: 55,
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
   * weapon:0001 is issued at signup and can also be bought.
   * Other weapons may only be bought as the next number up from the best weapon owned.
   */
  WEAPON_BUY_COSTS: {
    "weapon:0001": 1_500,
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
    { id: "against-the-odds", name: "Against the Odds", description: "Successfully complete a heist with a success chance under 15%.", reward: 75_000, sealed: true },
    { id: "big-spender", name: "Big Spender", description: "Spend $1,000,000 on weapons, upgrades and equipment", reward: 50_000, sealed: true },
    { id: "paper-trail", name: "Paper Trail", description: "Accumulate 100 recorded transactions in your ledger", reward: 25_000, sealed: true },
    { id: "first-entry", name: "First Entry", description: "Establish your first operational base.", reward: 1_000 },
    { id: "first-craft", name: "First Craft", description: "Collect your first crafted modification from the workshop.", reward: 5_000 },
    { id: "first-mod", name: "Fitted", description: "Install your first modification on a weapon or vault.", reward: 100_000 },
    { id: "clean-hands", name: "Clean Hands", description: "Complete 10 contracts without raising heat.", reward: 5_000 },
    { id: "false-bottom", name: "False Bottom", description: "Upgrade your vault to level 5.", reward: 5_000 },
    { id: "redacted", name: "Redacted", description: "Complete 15 successful heists.", reward: 5_000, sealed: true },
  ] as { id: string; name: string; description: string; reward: number; sealed?: boolean }[],
  /** Successful heists required before Redacted unlocks. The client never shows this number. */
  REDACTED_HEIST_GOAL: 15,
  CLEAN_HANDS_CONTRACTS: 10,
  /**
   * Cash to raise a weapon FROM this upgrade level to the next.
   * Keys are the current upgrade level (1, 2, or 3). Level 4 is the cap.
   */
  WEAPON_UPGRADE_COSTS: {
    "weapon:0001": { 1: 1_500, 2: 6_000, 3: 10_000 },
    "weapon:0002": { 1: 2_000, 2: 7_000, 3: 12_000 },
    "weapon:0003": { 1: 3_000, 2: 10_000, 3: 16_000 },
    "weapon:0004": { 1: 5_000, 2: 16_000, 3: 24_000 },
    "weapon:0005": { 1: 7_000, 2: 22_000, 3: 32_000 },
    "weapon:0006": { 1: 10_000, 2: 30_000, 3: 44_000 },
    "weapon:0007": { 1: 12_000, 2: 36_000, 3: 50_000 },
    "weapon:0008": { 1: 22_000, 2: 64_000, 3: 90_000 },
    "weapon:0009": { 1: 28_000, 2: 80_000, 3: 110_000 },
    "weapon:0010": { 1: 30_000, 2: 90_000, 3: 130_000 },
    "weapon:0011": { 1: 50_000, 2: 140_000, 3: 190_000 },
    "weapon:0012": { 1: 65_000, 2: 180_000, 3: 240_000 },
    "weapon:0013": { 1: 75_000, 2: 220_000, 3: 320_000 },
    "weapon:0014": { 1: 125_000, 2: 350_000, 3: 480_000 },
    "weapon:0015": { 1: 180_000, 2: 500_000, 3: 700_000 },
  } as Record<string, Record<number, number>>,
  /**
   * Cash to raise a vault FROM this level to the next.
   * Level 1 keeps the original price. Level 2 and above are doubled.
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
  /** Storage only. Defense tables are separate and are not derived from these caps. */
  VAULT_CAPACITY_BASE: {
    standard: 35_000,
    silver: 75_000,
    gold: 165_000,
    diamond: 2_000_000,
  } as Record<string, number>,
  VAULT_CAPACITY_STEP: {
    standard: 5_000,
    silver: 10_000,
    gold: 25_000,
    diamond: 250_000,
  } as Record<string, number>,
  HEAT_SUCCESS: 8,
  HEAT_FAIL: 15,
  HEAT_HIGH_VALUE: 12,
  HEAT_CRITICAL: 15,
  HEAT_HIGH_VALUE_AT: 50_000,
  HEAT_CRITICAL_MISS: 30,
  HEAT_ACTIVE_WORK: 10,
  HEAT_PASSIVE_DAY: 6,
  HEAT_DECAY: 5,
  HEAT_DECAY_HOURS: 2,
  HEAT_POLICE_AT: 50,
  HEAT_POLICE_WIPE_AT: 100,
  /** Three checks per UTC day. The clock stays on the server. */
  HEAT_CHECKS_PER_DAY: 3,
  HEAT_CHECK_GAP_HOURS: 7,
  HEAT_WARNING_MS: 60_000,
  /** Percent of the balance a heist cannot touch. Level 1 standard is 0 so a fresh vault is fully exposed. */
  VAULT_SECURED_PERCENT: {
    standard: [0, 15, 25, 35, 45],
    silver: [50, 55, 60, 65, 70],
    gold: [72, 76, 80, 84, 88],
    diamond: [90, 92, 94, 96, 98],
  } as Record<string, number[]>,
  /** Cash to raise a vault one level inside the current tier. Diamond L1→L5 steps are flat $100k. */
  VAULT_LEVEL_COSTS: {
    standard: { 1: 8_000, 2: 36_000, 3: 80_000, 4: 180_000 },
    silver: { 1: 120_000, 2: 400_000, 3: 640_000, 4: 960_000 },
    gold: { 1: 700_000, 2: 2_200_000, 3: 3_200_000, 4: 4_400_000 },
    diamond: { 1: 100_000, 2: 100_000, 3: 100_000, 4: 100_000 },
  } as Record<string, Record<number, number>>,
  VAULT_CONVERSION_COSTS: {
    standard: 500_000,
    silver: 3_000_000,
    gold: 20_000_000,
  } as Record<string, number>,
  /**
   * Modification slot unlocks by player level (independent of vault tier).
   * Actual mods install in a later stage; slots are authoritative here.
   */
  VAULT_MOD_SLOTS_BY_LEVEL: [
    { minLevel: 35, slots: 4 },
    { minLevel: 25, slots: 3 },
    { minLevel: 20, slots: 2 },
    { minLevel: 15, slots: 1 },
    { minLevel: 1, slots: 0 },
  ] as { minLevel: number; slots: number }[],
  WEAPON_MOD_SLOTS_BY_LEVEL: [
    { minLevel: 35, slots: 3 },
    { minLevel: 25, slots: 2 },
    { minLevel: 15, slots: 1 },
    { minLevel: 1, slots: 0 },
  ] as { minLevel: number; slots: number }[],
  /** Property levels 11–20 use this curve; 1–10 keep the legacy propertyService formula. */
  PROPERTY_MAX_LEVEL: 20,
  PROPERTY_LEGACY_MAX_LEVEL: 10,
  PROPERTY_UPGRADE_GROWTH: 1.45,
  PROPERTY_UPGRADE_MILESTONE_MULT: {
    12: 1,
    13: 1,
    14: 1,
    15: 1.5,
    16: 1,
    17: 1,
    18: 1.25,
    19: 1,
    20: 2,
  } as Record<number, number>,
  /** One price per tier, for one day. Insurance closes the vault again after a hit. */
  INSURANCE_DAILY: {
    standard: 1_750,
    silver: 2_750,
    gold: 3_500,
    diamond: 4_250,
  } as Record<string, number>,
  INSURANCE_HOURS: 24,
  /** Reputation titles. The highest entry a player's level reaches wins. */
  TITLES: [
    { minLevel: 1, title: "Street Operator" },
    { minLevel: 2, title: "City Dweller" },
    { minLevel: 3, title: "Expert Negotiator" },
    { minLevel: 4, title: "Peak Businessman" },
    { minLevel: 5, title: "Mob Boss" },
    { minLevel: 11, title: "Territory Baron" },
    { minLevel: 12, title: "Established Criminal" },
    { minLevel: 20, title: "Regional Power" },
    { minLevel: 30, title: "Criminal Empire" },
    { minLevel: 40, title: "Underworld Elite" },
    { minLevel: 50, title: "Underworld Elite" },
  ] as { minLevel: number; title: string }[],
  /**
   * Reputation is the player level. Claiming a rung pays the reward and
   * raises the level that work and the dossier use. Everyone starts at 1.
   * Level 5 finishes every holding that the earlier rungs left short of level 5.
   * Levels 12–50 each pay exactly $100,000 once (see lateReputation).
   * Existing Level 11+ accounts are grandfathered past the new Diamond L5 gate
   * (that gate only applies when advancing into Level 11).
   */
  REPUTATION_MAX_LEVEL: 50,
  LEVEL_UP_REWARD_FROM: 12,
  LEVEL_UP_REWARD_CASH: 100_000,
  /**
   * Post-10 territory org. Config only — do not hardcode limits in services.
   * maxSectorsByLevel: total holdings including original base.
   */
  TERRITORY: {
    UNLOCK_LEVEL: 11,
    MAX_SECTORS_BY_LEVEL: { 11: 2, 25: 3, 40: 4, 50: 5 } as Record<number, number>,
    VAULT_CAPITAL_REQUIRED: 500_000,
    STAGE_MINUTES: { scout: 0, claim: 0 } as Record<string, number>,
    STAGES: ["scout", "claim"] as const,
    POLICE_PER_EXPAND: 15,
    POLICE_DECAY_PER_UTC_DAY: 5,
    POLICE_BANDS: [
      { under: 20, label: "LOW" },
      { under: 50, label: "ELEVATED" },
      { under: 80, label: "HIGH" },
      { under: 1_000_000, label: "CRITICAL" },
    ] as { under: number; label: string }[],
    CRITICAL_BLOCKS_EXPAND: 80,
    VAULT_YIELD_PCT_PER_HOUR: 0.25,
    VAULT_YIELD_REQUIRES_TIER: "diamond",
    VAULT_YIELD_NOON_MINUTE: 15,
    /**
     * Account-wide while you own specialized holdings. Same type stacks with diminishing extras:
     * Industrial base +4% / −2%; each extra Industrial +1% / −1%.
     * Financial base −5 min / +10%; each extra Financial −2 min / +2%.
     */
    SPECIALIZATIONS: {
      industrial: {
        attackBuffPercent: 4,
        attackBuffExtraPerStack: 1,
        defenseFlat: 2,
        defenseExtraPerStack: 1,
        label: "Industrial",
        blurb:
          "+4% heist success (+1% per extra Industrial). Enemies −2% success (−1% per extra). Same type stacks.",
      },
      financial: {
        workCooldownCutMinutes: 5,
        workCooldownExtraPerStack: 2,
        collectBonusPercent: 10,
        collectBonusExtraPerStack: 2,
        label: "Financial",
        blurb:
          "−5 min work cooldown (−2 min per extra Financial). +10% contract & passive pay (+2% per extra). Same type stacks.",
      },
    },
  },
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
    {
      level: 6,
      reward: 1_500_000,
      conditions: [
        { kind: "asset", id: "dock", minLevel: 1, label: "Buy a dock for the boat" },
        { kind: "asset", id: "speedboat", minLevel: 1, label: "Own a speedboat" },
        { kind: "asset", id: "garage", minLevel: 6, label: "Raise your garage to level 6" },
        { kind: "asset", id: "car", minLevel: 6, label: "Raise your car to level 6" },
        { kind: "asset", id: "truck", minLevel: 6, label: "Raise your truck to level 6" },
      ],
    },
    {
      level: 7,
      reward: 2_500_000,
      conditions: [
        { kind: "asset", id: "helipad", minLevel: 1, label: "Buy a helipad" },
        { kind: "asset", id: "helicopter", minLevel: 1, label: "Own a helicopter" },
        { kind: "asset", id: "dock", minLevel: 2, label: "Raise your dock to level 2" },
        { kind: "asset", id: "speedboat", minLevel: 2, label: "Raise your speedboat to level 2" },
        { kind: "asset", id: "hangar", minLevel: 6, label: "Raise your hangar to level 6" },
        { kind: "asset", id: "airplane", minLevel: 6, label: "Raise your airplane to level 6" },
      ],
    },
    {
      level: 8,
      reward: 4_000_000,
      conditions: [
        { kind: "asset", id: "chop-shop", minLevel: 1, label: "Buy a chop shop" },
        { kind: "asset", id: "armored-van", minLevel: 1, label: "Own an armored van" },
        { kind: "asset", id: "helipad", minLevel: 3, label: "Raise your helipad to level 3" },
        { kind: "asset", id: "helicopter", minLevel: 3, label: "Raise your helicopter to level 3" },
        { kind: "asset", id: "dock", minLevel: 4, label: "Raise your dock to level 4" },
        { kind: "asset", id: "speedboat", minLevel: 4, label: "Raise your speedboat to level 4" },
        { kind: "asset", id: "front", minLevel: 7, label: "Raise your front business to level 7" },
      ],
    },
    {
      level: 9,
      reward: 6_000_000,
      conditions: [
        { kind: "asset", id: "casino", minLevel: 1, label: "Buy a casino" },
        { kind: "asset", id: "limousine", minLevel: 1, label: "Own a limousine" },
        { kind: "asset", id: "chop-shop", minLevel: 3, label: "Raise your chop shop to level 3" },
        { kind: "asset", id: "armored-van", minLevel: 3, label: "Raise your armored van to level 3" },
        { kind: "asset", id: "warehouse", minLevel: 8, label: "Raise your warehouse to level 8" },
        { kind: "asset", id: "bike", minLevel: 8, label: "Raise your bike to level 8" },
      ],
    },
    {
      level: 10,
      reward: 10_000_000,
      conditions: [
        { kind: "asset", id: "estate", minLevel: 1, label: "Buy an estate" },
        { kind: "asset", id: "yacht", minLevel: 1, label: "Own a yacht" },
        { kind: "asset", id: "casino", minLevel: 3, label: "Raise your casino to level 3" },
        { kind: "asset", id: "limousine", minLevel: 3, label: "Raise your limousine to level 3" },
        { kind: "asset", id: "dock", minLevel: 5, label: "Raise your dock to level 5" },
        { kind: "asset", id: "helipad", minLevel: 5, label: "Raise your helipad to level 5" },
        { kind: "asset", id: "chop-shop", minLevel: 5, label: "Raise your chop shop to level 5" },
        { kind: "asset", id: "speedboat", minLevel: 5, label: "Raise your speedboat to level 5" },
        { kind: "asset", id: "helicopter", minLevel: 5, label: "Raise your helicopter to level 5" },
        { kind: "asset", id: "armored-van", minLevel: 5, label: "Raise your armored van to level 5" },
        { kind: "asset", id: "garage", minLevel: 10, label: "Raise your garage to level 10" },
        { kind: "asset", id: "car", minLevel: 10, label: "Raise your car to level 10" },
        { kind: "asset", id: "hangar", minLevel: 10, label: "Raise your hangar to level 10" },
        { kind: "asset", id: "airplane", minLevel: 10, label: "Raise your airplane to level 10" },
        { kind: "asset", id: "truck", minLevel: 10, label: "Raise your truck to level 10" },
      ],
    },
    {
      level: 11,
      reward: 0,
      fee: 5_000_000,
      unlocks: ["Territory expansion", "Vault credit card", "Diamond vault yield"],
      conditions: [
        { kind: "vaultTier", tier: "diamond", minLevel: 5, label: "Diamond Vault Level 5" },
        { kind: "asset", id: "garage", minLevel: 5, label: "Garage at least level 5" },
        { kind: "asset", id: "safehouse", minLevel: 5, label: "Safehouse at least level 5" },
        { kind: "asset", id: "hangar", minLevel: 5, label: "Hangar at least level 5" },
        { kind: "asset", id: "caravan", minLevel: 5, label: "Caravan at least level 5" },
        { kind: "asset", id: "warehouse", minLevel: 5, label: "Warehouse at least level 5" },
        { kind: "asset", id: "front", minLevel: 5, label: "Front business at least level 5" },
        { kind: "asset", id: "dock", minLevel: 5, label: "Dock at least level 5" },
        { kind: "asset", id: "helipad", minLevel: 5, label: "Helipad at least level 5" },
        { kind: "asset", id: "chop-shop", minLevel: 5, label: "Chop shop at least level 5" },
        { kind: "asset", id: "casino", minLevel: 5, label: "Casino at least level 5" },
        { kind: "asset", id: "estate", minLevel: 5, label: "Estate at least level 5" },
        { kind: "asset", id: "car", minLevel: 5, label: "Car at least level 5" },
        { kind: "asset", id: "bike", minLevel: 5, label: "Bike at least level 5" },
        { kind: "asset", id: "truck", minLevel: 5, label: "Truck at least level 5" },
        { kind: "asset", id: "airplane", minLevel: 5, label: "Airplane at least level 5" },
        { kind: "asset", id: "speedboat", minLevel: 5, label: "Speedboat at least level 5" },
        { kind: "asset", id: "helicopter", minLevel: 5, label: "Helicopter at least level 5" },
        { kind: "asset", id: "armored-van", minLevel: 5, label: "Armored van at least level 5" },
        { kind: "asset", id: "limousine", minLevel: 5, label: "Limousine at least level 5" },
        { kind: "asset", id: "yacht", minLevel: 5, label: "Yacht at least level 5" },
      ],
    },
    ...buildLateReputation(),
  ] as {
    level: number;
    reward: number;
    fee?: number;
    unlocks?: string[];
    milestone?: boolean;
    conditions: {
      kind: "asset" | "passive" | "cash" | "vault" | "vaultTier" | "heists" | "contracts" | "territory" | "weaponLevel" | "craft";
      id?: string;
      minLevel?: number;
      min?: number;
      tier?: string;
      label: string;
    }[];
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
  /** Shared board: this many contracts, redrawn at random each window. */
  WORK_BOARD_SIZE: 9,
  WORK_BOARD_ROTATION_MINUTES: 60,
  /** After collecting, that one contract is unavailable for this long. */
  WORK_CONTRACT_COOLDOWN_MINUTES: 20,
  /** A failed heist leaves the attacker's vault unprotected for this long. */
  FAILED_HEIST_EXPOSURE_HOURS: 1,
  /** Against the Odds: a successful heist under this chance. */
  AGAINST_THE_ODDS_CHANCE: 15,
  /** Inside Job: the target must have crossed your ledger within this many days. */
  INSIDE_JOB_DAYS: 7,
  BIG_SPENDER_CENTS: 1_000_000,
  PAPER_TRAIL_COUNT: 100,
  LEADERBOARD_SIZE: 25,
  PASSIVE_JOBS: [
    { id: "volunteer", name: "Volunteer", payPerDay: 300, minReputation: 1, requires: [] },
    { id: "mail-man", name: "Mail Man", payPerDay: 450, minReputation: 1, requires: [] },
    { id: "package-runner", name: "Package Runner", payPerDay: 3_200, minReputation: 1, requires: [{ id: "bike", minLevel: 1 }] },
    { id: "street-lookout", name: "Street Lookout", payPerDay: 3_400, minReputation: 1, requires: [{ id: "safehouse", minLevel: 1 }] },
    { id: "shop-security", name: "Shop Security", payPerDay: 3_600, minReputation: 1, requires: [{ id: "safehouse", minLevel: 1 }] },
    { id: "warehouse-loader", name: "Warehouse Loader", payPerDay: 3_800, minReputation: 1, requires: [{ id: "warehouse", minLevel: 1 }] },
    { id: "document-runner", name: "Document Runner", payPerDay: 4_200, minReputation: 2, requires: [{ id: "safehouse", minLevel: 2 }, { id: "bike", minLevel: 2 }] },
    { id: "night-courier", name: "Night Courier", payPerDay: 4_500, minReputation: 2, requires: [{ id: "hangar", minLevel: 2 }, { id: "bike", minLevel: 2 }] },
    { id: "local-transport", name: "Local Transport", payPerDay: 4_800, minReputation: 2, requires: [{ id: "hangar", minLevel: 2 }, { id: "truck", minLevel: 2 }] },
    { id: "cash-collection", name: "Cash Collection", payPerDay: 5_200, minReputation: 2, requires: [{ id: "front", minLevel: 2 }, { id: "car", minLevel: 2 }] },
    { id: "delivery-worker", name: "Delivery Worker", payPerDay: 5_500, minReputation: 3, requires: [{ id: "hangar", minLevel: 3 }, { id: "truck", minLevel: 2 }] },
    { id: "private-driver", name: "Private Driver", payPerDay: 6_000, minReputation: 3, requires: [{ id: "hangar", minLevel: 3 }, { id: "car", minLevel: 3 }] },
    { id: "front-counter", name: "Front Counter", payPerDay: 6_500, minReputation: 4, requires: [{ id: "front", minLevel: 4 }, { id: "hangar", minLevel: 4 }] },
    { id: "truck-route", name: "Truck Route", payPerDay: 7_000, minReputation: 4, requires: [{ id: "truck", minLevel: 2 }, { id: "airplane", minLevel: 4 }, { id: "bike", minLevel: 4 }] },
    { id: "yard-lease", name: "Yard Lease", payPerDay: 7_500, minReputation: 5, requires: [{ id: "hangar", minLevel: 5 }, { id: "front", minLevel: 5 }, { id: "safehouse", minLevel: 5 }] },
    { id: "convoy-desk", name: "Convoy Desk", payPerDay: 8_000, minReputation: 5, requires: [{ id: "truck", minLevel: 5 }, { id: "airplane", minLevel: 5 }, { id: "caravan", minLevel: 5 }, { id: "warehouse", minLevel: 5 }] },
    { id: "harbor-watch", name: "Harbor Watch", payPerDay: 8_500, minReputation: 6, requires: [{ id: "hangar", minLevel: 6 }, { id: "dock", minLevel: 2 }, { id: "speedboat", minLevel: 2 }] },
    { id: "coast-run", name: "Coast Run", payPerDay: 9_000, minReputation: 6, requires: [{ id: "truck", minLevel: 6 }, { id: "car", minLevel: 6 }, { id: "garage", minLevel: 6 }, { id: "speedboat", minLevel: 2 }] },
    {
      id: "plant-payroll",
      name: "Plant Payroll",
      payPerDay: 20_000,
      minReputation: 14,
      requires: [
        { id: "manufacturing-plant", minLevel: 2 },
        { id: "warehouse", minLevel: 8 },
        { id: "front", minLevel: 7 },
      ],
    },
    {
      id: "sector-tithe",
      name: "Sector Tithe",
      payPerDay: 25_000,
      minReputation: 20,
      requires: [
        { id: "manufacturing-plant", minLevel: 3 },
        { id: "chop-shop", minLevel: 5 },
        { id: "dock", minLevel: 5 },
        { id: "warehouse", minLevel: 10 },
      ],
    },
    {
      id: "casino-skim",
      name: "Casino Skim",
      payPerDay: 27_000,
      minReputation: 19,
      requires: [
        { id: "casino", minLevel: 16 },
        { id: "limousine", minLevel: 16 },
        { id: "garage", minLevel: 14 },
      ],
    },
    {
      id: "airbridge-lease",
      name: "Airbridge Lease",
      payPerDay: 30_000,
      minReputation: 23,
      requires: [
        { id: "hangar", minLevel: 18 },
        { id: "airplane", minLevel: 18 },
        { id: "warehouse", minLevel: 16 },
        { id: "manufacturing-plant", minLevel: 3 },
      ],
    },
  ] as { id: string; name: string; payPerDay: number; minReputation: number; requires: { id?: string; anyVehicle?: boolean; minLevel: number }[] }[],
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
      id: "alley-errand",
      name: "Alley Errand",
      minLevel: 1,
      durationMinutes: 8,
      reward: 2_100,
      risk: "LOW",
      locationLabel: "Copper Street",
      requires: [{ id: "bike", minLevel: 1 }],
    },
    {
      id: "stoop-watch",
      name: "Stoop Watch",
      minLevel: 1,
      durationMinutes: 11,
      reward: 2_300,
      risk: "LOW",
      locationLabel: "Dock Row",
      requires: [{ id: "safehouse", minLevel: 1 }],
    },
    {
      id: "courier-run",
      name: "Courier Run",
      minLevel: 2,
      durationMinutes: 8,
      reward: 3_200,
      risk: "LOW",
      locationLabel: "Old Tram Line",
    },
    {
      id: "ledger-scrub",
      name: "Ledger Scrub",
      minLevel: 2,
      durationMinutes: 15,
      reward: 6_500,
      risk: "MEDIUM",
      locationLabel: "Copper Street Counting House",
    },
    {
      id: "night-unload",
      name: "Night Unload",
      minLevel: 3,
      durationMinutes: 25,
      reward: 11_000,
      risk: "MEDIUM",
      locationLabel: "Pier Fourteen",
    },
    {
      id: "plate-swap",
      name: "Plate Swap",
      minLevel: 3,
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
      id: "bay-count",
      name: "Bay Count",
      minLevel: 2,
      durationMinutes: 14,
      reward: 2_100,
      risk: "LOW",
      locationLabel: "Marrow Lane Garage",
      requires: [{ id: "garage", minLevel: 2 }],
    },
    {
      id: "first-fare",
      name: "First Fare",
      minLevel: 2,
      durationMinutes: 16,
      reward: 2_300,
      risk: "LOW",
      locationLabel: "Old Tram Line",
      requires: [{ id: "car", minLevel: 2 }, { id: "garage", minLevel: 2 }],
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
      id: "wing-check",
      name: "Wing Check",
      minLevel: 3,
      durationMinutes: 20,
      reward: 9_800,
      risk: "MEDIUM",
      locationLabel: "Freeport Annex",
      requires: [{ id: "hangar", minLevel: 2 }, { id: "airplane", minLevel: 2 }],
    },
    {
      id: "second-shift",
      name: "Second Shift",
      minLevel: 3,
      durationMinutes: 24,
      reward: 10_600,
      risk: "MEDIUM",
      locationLabel: "Copper Street",
      requires: [{ id: "garage", minLevel: 3 }, { id: "car", minLevel: 3 }, { id: "bike", minLevel: 2 }],
    },
    {
      id: "customs-favour",
      name: "Customs Favour",
      minLevel: 4,
      durationMinutes: 95,
      reward: 55_000,
      risk: "HIGH",
      locationLabel: "Freeport Annex",
    },
    {
      id: "counter-skim",
      name: "Counter Skim",
      minLevel: 4,
      durationMinutes: 36,
      reward: 16_500,
      risk: "MEDIUM",
      locationLabel: "Copper Street Counting House",
      requires: [{ id: "front", minLevel: 4 }, { id: "hangar", minLevel: 4 }],
    },
    {
      id: "load-call",
      name: "Load Call",
      minLevel: 4,
      durationMinutes: 42,
      reward: 17_500,
      risk: "MEDIUM",
      locationLabel: "Pier Fourteen",
      requires: [{ id: "truck", minLevel: 2 }, { id: "airplane", minLevel: 4 }, { id: "bike", minLevel: 4 }],
    },
    {
      id: "armoured-tail",
      name: "Armoured Tail",
      minLevel: 5,
      durationMinutes: 210,
      reward: 96_000,
      risk: "HIGH",
      locationLabel: "Ring Road North",
    },
    {
      id: "vault-survey",
      name: "Vault Survey",
      minLevel: 5,
      durationMinutes: 300,
      reward: 165_000,
      risk: "HIGH",
      locationLabel: "Iron Hour Depository",
      difficulty: "ELITE",
      requiresProperty: "garage",
    },
    {
      id: "lot-audit",
      name: "Lot Audit",
      minLevel: 5,
      durationMinutes: 95,
      reward: 54_000,
      risk: "HIGH",
      locationLabel: "Marrow Lane Garage",
      requires: [
        { id: "hangar", minLevel: 5 },
        { id: "front", minLevel: 5 },
        { id: "safehouse", minLevel: 5 },
      ],
    },
    {
      id: "yard-convoy",
      name: "Yard Convoy",
      minLevel: 5,
      durationMinutes: 95,
      reward: 58_000,
      risk: "HIGH",
      locationLabel: "Ring Road North",
      requires: [
        { id: "truck", minLevel: 5 },
        { id: "airplane", minLevel: 5 },
        { id: "caravan", minLevel: 5 },
        { id: "warehouse", minLevel: 5 },
      ],
    },
    {
      id: "pier-watch",
      name: "Pier Watch",
      minLevel: 6,
      durationMinutes: 300,
      reward: 128_000,
      risk: "HIGH",
      locationLabel: "Pier Fourteen",
      requires: [
        { id: "hangar", minLevel: 6 },
        { id: "dock", minLevel: 2 },
        { id: "speedboat", minLevel: 2 },
      ],
    },
    {
      id: "coast-haul",
      name: "Coast Haul",
      minLevel: 6,
      durationMinutes: 300,
      reward: 135_000,
      risk: "HIGH",
      locationLabel: "Freeport Annex",
      requires: [
        { id: "truck", minLevel: 6 },
        { id: "car", minLevel: 6 },
        { id: "garage", minLevel: 6 },
        { id: "speedboat", minLevel: 2 },
      ],
    },
    {
      id: "territory-courier",
      name: "Territory Courier",
      minLevel: 11,
      durationMinutes: 120,
      reward: 60_000,
      risk: "HIGH",
      locationLabel: "Claimed Sector Perimeter",
      difficulty: "HARD",
      requires: [
        { id: "car", minLevel: 8 },
        { id: "garage", minLevel: 8 },
        { id: "safehouse", minLevel: 8 },
      ],
    },
    {
      id: "airfield-handoff",
      name: "Airfield Handoff",
      minLevel: 13,
      durationMinutes: 80,
      reward: 45_000,
      risk: "HIGH",
      locationLabel: "Freeport Annex",
      difficulty: "HARD",
      requires: [
        { id: "hangar", minLevel: 12 },
        { id: "airplane", minLevel: 12 },
        { id: "warehouse", minLevel: 10 },
      ],
    },
    {
      id: "plant-night-shift",
      name: "Plant Night Shift",
      minLevel: 15,
      durationMinutes: 150,
      reward: 70_000,
      risk: "HIGH",
      locationLabel: "Manufacturing Plant Yard",
      difficulty: "VERY HARD",
      requires: [
        { id: "manufacturing-plant", minLevel: 2 },
        { id: "truck", minLevel: 8 },
        { id: "warehouse", minLevel: 8 },
      ],
    },
    {
      id: "floor-manager",
      name: "Floor Manager",
      minLevel: 19,
      durationMinutes: 95,
      reward: 70_000,
      risk: "HIGH",
      locationLabel: "Casino Pit",
      difficulty: "VERY HARD",
      requires: [
        { id: "casino", minLevel: 16 },
        { id: "limousine", minLevel: 16 },
        { id: "garage", minLevel: 14 },
      ],
    },
    {
      id: "diamond-escort",
      name: "Diamond Escort",
      minLevel: 20,
      durationMinutes: 210,
      reward: 80_000,
      risk: "HIGH",
      locationLabel: "Iron Hour Corridor",
      difficulty: "ELITE",
      requires: [
        { id: "manufacturing-plant", minLevel: 3 },
        { id: "chop-shop", minLevel: 5 },
        { id: "caravan", minLevel: 8 },
        { id: "front", minLevel: 10 },
      ],
    },
    {
      id: "safehouse-relay",
      name: "Safehouse Relay",
      minLevel: 21,
      durationMinutes: 210,
      reward: 85_000,
      risk: "HIGH",
      locationLabel: "Outer Safehouse Ring",
      difficulty: "ELITE",
      requires: [
        { id: "safehouse", minLevel: 18 },
        { id: "caravan", minLevel: 18 },
        { id: "dock", minLevel: 14 },
      ],
    },
    {
      id: "warehouse-blackout",
      name: "Warehouse Blackout",
      minLevel: 26,
      durationMinutes: 210,
      reward: 99_000,
      risk: "HIGH",
      locationLabel: "Bonded Warehouse Row",
      difficulty: "ELITE",
      requires: [
        { id: "warehouse", minLevel: 20 },
        { id: "truck", minLevel: 20 },
        { id: "casino", minLevel: 16 },
      ],
    },
    {
      id: "dockside-ledger",
      name: "Dockside Ledger",
      minLevel: 31,
      durationMinutes: 300,
      reward: 110_000,
      risk: "HIGH",
      locationLabel: "Deepwater Quay",
      difficulty: "ELITE",
      requires: [
        { id: "safehouse", minLevel: 20 },
        { id: "caravan", minLevel: 20 },
        { id: "dock", minLevel: 20 },
        { id: "manufacturing-plant", minLevel: 4 },
      ],
    },
    {
      id: "rotor-sweep",
      name: "Rotor Sweep",
      minLevel: 35,
      durationMinutes: 300,
      reward: 120_000,
      risk: "HIGH",
      locationLabel: "Helipad Spine",
      difficulty: "ELITE",
      requires: [
        { id: "helipad", minLevel: 20 },
        { id: "helicopter", minLevel: 20 },
        { id: "chop-shop", minLevel: 20 },
      ],
    },
    {
      id: "black-rotor-run",
      name: "Black Rotor Run",
      minLevel: 45,
      durationMinutes: 300,
      reward: 135_000,
      risk: "HIGH",
      locationLabel: "Night Helipad Circuit",
      difficulty: "ELITE",
      requires: [
        { id: "helipad", minLevel: 20 },
        { id: "helicopter", minLevel: 20 },
        { id: "chop-shop", minLevel: 20 },
        { id: "manufacturing-plant", minLevel: 5 },
      ],
    },
    {
      id: "estate-endgame",
      name: "Estate Endgame",
      minLevel: 50,
      durationMinutes: 300,
      reward: 150_000,
      risk: "HIGH",
      locationLabel: "Estate & Yacht Corridor",
      difficulty: "ELITE",
      requires: [
        { id: "estate", minLevel: 20 },
        { id: "yacht", minLevel: 20 },
        { id: "hangar", minLevel: 20 },
        { id: "manufacturing-plant", minLevel: 5 },
      ],
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
    requires?: { id: string; minLevel: number }[];
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
  const base = RULES.VAULT_CAPACITY_BASE[tier] ?? RULES.VAULT_CAPACITY_BASE.standard;
  const step = RULES.VAULT_CAPACITY_STEP[tier] ?? RULES.VAULT_CAPACITY_STEP.standard;
  const bonus = level >= 4 ? 20_000 : level >= 3 ? 10_000 : 0;
  let capacity = base + vaultIndex(level) * step + bonus;
  if (tier === "standard" && level === 5) capacity += 5_000;
  if (level === 5) capacity += 10_000;
  if (tier === "silver") capacity += (level === 1 ? 10_000 : 0) + (level === 2 ? 10_000 : 0) + 5_000;
  if (tier === "gold") capacity += 30_000;
  return capacity;
}

/** L11+ card holders on Diamond L5+: no storage cap. Pre-L11 unchanged. */
export function vaultCapacityUnlimited(tier: string, level: number, creditCard: boolean): boolean {
  return Boolean(creditCard && tier === "diamond" && level >= RULES.VAULT_MAX_LEVEL);
}

export function vaultSecuredPercent(tier: string, level: number): number {
  const row = RULES.VAULT_SECURED_PERCENT[tier] ?? RULES.VAULT_SECURED_PERCENT.standard;
  return row[vaultIndex(level)] ?? 0;
}

export function exposedBalance(balance: number, tier: string, level: number): number {
  const secured = Math.floor((Math.max(0, balance) * vaultSecuredPercent(tier, level)) / 100);
  return Math.max(0, balance - secured);
}

export function insurancePremium(tier: string): number {
  return RULES.INSURANCE_DAILY[tier] ?? RULES.INSURANCE_DAILY.standard;
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

export function vaultModSlotsForLevel(playerLevel: number): number {
  for (const row of RULES.VAULT_MOD_SLOTS_BY_LEVEL) {
    if (playerLevel >= row.minLevel) return row.slots;
  }
  return 0;
}

export function weaponModSlotsForLevel(playerLevel: number): number {
  for (const row of RULES.WEAPON_MOD_SLOTS_BY_LEVEL) {
    if (playerLevel >= row.minLevel) return row.slots;
  }
  return 0;
}

/** Progression phase label for UI (not a separate level system). */
export function progressionPhase(level: number): string {
  if (level >= 40) return "Underworld Elite";
  if (level >= 30) return "Criminal Empire";
  if (level >= 20) return "Regional Power";
  if (level >= 12) return "Established Criminal";
  if (level >= 11) return "Territory Baron";
  return "Street ladder";
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
  return currentLevel >= 2 ? cost * 2 : cost;
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
