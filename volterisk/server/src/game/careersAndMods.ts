/** Careers, repair refs, weapon/vault mods — authoritative balance tables. */

export const CAREER_IDS = ["kingpin", "tycoon", "enforcer"] as const;
export type CareerId = (typeof CAREER_IDS)[number];

export const CAREERS = {
  SWITCH_PRIMARY_FEE: 2_000_000,
  SWITCH_PRIMARY_COOLDOWN_MS: 7 * 24 * 60 * 60 * 1000,
  SECONDARY_UNLOCK_LEVEL: 30,
  SWITCH_SECONDARY_FEE: 500_000,
  /** Modest bonuses. Secondary applies at half strength. Never touches Heat. */
  BONUSES: {
    kingpin: {
      label: "Kingpin",
      blurb: "Territory and operations. +3% heist success while you hold 2+ sectors.",
      heistChanceFlat: 3,
      needsSectors: 2,
    },
    tycoon: {
      label: "Tycoon",
      blurb: "Wealth and properties. +5% cash on contract collect and passive payday.",
      workCollectBonusPercent: 5,
    },
    enforcer: {
      label: "Enforcer",
      blurb: "Weapons and heists. +2 attack on heist attempts.",
      heistAttackFlat: 2,
    },
  },
} as const;

export const WEAPON_REPAIR_FULL_COST: Record<string, number> = {
  "weapon:0001": 1_000,
  "weapon:0002": 1_500,
  "weapon:0003": 2_000,
  "weapon:0004": 2_500,
  "weapon:0005": 3_500,
  "weapon:0006": 4_000,
  "weapon:0007": 5_000,
  "weapon:0008": 7_500,
  "weapon:0009": 9_000,
  "weapon:0010": 12_000,
  "weapon:0011": 15_000,
  "weapon:0012": 18_000,
  "weapon:0013": 22_000,
  "weapon:0014": 30_000,
  "weapon:0015": 40_000,
};

export type ModTier = "basic" | "intermediate" | "advanced";

export type WeaponModDef = {
  id: string;
  name: string;
  kind: "weapon";
  tier: ModTier;
  shopPrice: number | null;
  description: string;
  /** Flat attack adjust before other effects. */
  attackFlat?: number;
  repairCostMult?: number;
  durabilityLossMult?: number;
  extraDurabilityLoss?: number;
  /** Added to weapon max (and current) durability while installed. */
  maxDurabilityBonus?: number;
  /** If true, removing destroys the mod instance instead of returning it to inventory. */
  breaksOnRemove?: boolean;
  chanceWhenWithin?: { window: number; points: number };
  noBonusWhenAdvantageOver?: number;
  rewardMult?: number;
  /** Against vault defence >= this. */
  attackVsDefenseMin?: { minDefense: number; attackFlat: number };
  /** Reinforced = gold/diamond vault tiers. */
  attackVsReinforced?: number;
  attackVsLowerSecurity?: number;
  /** Adaptive lock: bonus when defense - attack <= 20; penalty when higher. */
  adaptiveLock?: { within: number; chancePoints: number; attackFlatWhenHigher: number };
};

export type TerritoryModDef = {
  id: string;
  name: string;
  kind: "territory";
  tier: ModTier;
  shopPrice: null;
  description: string;
};

export type VaultModDef = {
  id: string;
  name: string;
  kind: "vault";
  tier: ModTier;
  shopPrice: number | null;
  description: string;
  defenseFlat?: number;
  defenseWhenAdvantageAtMost?: { advantage: number; defenseFlat: number };
  defenseWhenAttackNotAbove?: number;
  emergencyLockdown?: { defenseFlat: number; cooldownMs: number };
  defenseWhenAdvantageOver?: { advantage: number; defenseFlat: number };
  cutSpecialAttackBonusHalf?: boolean;
  heistRewardMultOnSuccess?: number;
  reduceAdvantageBy?: number;
  defenseWhenSecuredPercentAtLeast?: { percent: number; defenseFlat: number; minTier: "gold" | "diamond" };
  lossReductionMult?: number;
  requiresExotic?: boolean;
  installMaterialCostMult?: number;
};

export const WEAPON_MOD_INSTALL_FEE: Record<ModTier, number> = {
  basic: 5_000,
  intermediate: 15_000,
  advanced: 35_000,
};

export const WEAPON_MODS: WeaponModDef[] = [
  {
    id: "reinforced-grip",
    name: "Reinforced Grip",
    kind: "weapon",
    tier: "basic",
    shopPrice: null,
    description: "+3 Attack. Full-repair reference cost +10%. Craft in Workshop.",
    attackFlat: 3,
    repairCostMult: 1.1,
  },
  {
    id: "precision-calibrator",
    name: "Precision Calibrator",
    kind: "weapon",
    tier: "basic",
    shopPrice: 35_000,
    description: "+5 pp when attack is within 10 of defence. No bonus when advantage > 10.",
    chanceWhenWithin: { window: 10, points: 5 },
    noBonusWhenAdvantageOver: 10,
  },
  {
    id: "wear-guard",
    name: "Wear Guard",
    kind: "weapon",
    tier: "basic",
    shopPrice: null,
    description: "25% less durability loss per heist. −2 Attack. Craft in Workshop.",
    durabilityLossMult: 0.75,
    attackFlat: -2,
  },
  {
    id: "heat-suppressor",
    name: "Heat Suppressor",
    kind: "weapon",
    tier: "basic",
    shopPrice: 28_000,
    description: "−2 Attack. Full-repair reference +10%. Does not change Heat.",
    attackFlat: -2,
    repairCostMult: 1.1,
  },
  {
    id: "kinetic-amplifier",
    name: "Kinetic Amplifier",
    kind: "weapon",
    tier: "intermediate",
    shopPrice: null,
    description: "+8 Attack. One extra durability loss per heist.",
    attackFlat: 8,
    extraDurabilityLoss: 1,
  },
  {
    id: "adaptive-lock-interface",
    name: "Adaptive Lock Interface",
    kind: "weapon",
    tier: "intermediate",
    shopPrice: null,
    description: "+6 pp when defence is at most 20 above attack. −3 Attack vs higher defence.",
    adaptiveLock: { within: 20, chancePoints: 6, attackFlatWhenHigher: -3 },
  },
  {
    id: "composite-reinforcement",
    name: "Composite Reinforcement",
    kind: "weapon",
    tier: "intermediate",
    shopPrice: null,
    description: "40% less durability loss. −4 Attack.",
    durabilityLossMult: 0.6,
    attackFlat: -4,
  },
  {
    id: "thermal-regulator",
    name: "Thermal Regulator",
    kind: "weapon",
    tier: "intermediate",
    shopPrice: null,
    description: "+8 Attack vs reinforced (gold/diamond) vaults. −3 vs lower-security.",
    attackVsReinforced: 8,
    attackVsLowerSecurity: -3,
  },
  {
    id: "phase-alignment-core",
    name: "Phase Alignment Core",
    kind: "weapon",
    tier: "advanced",
    shopPrice: null,
    description: "+12 Attack vs defence 100+. Repair reference +15%. No Heat effect.",
    attackVsDefenseMin: { minDefense: 100, attackFlat: 12 },
    repairCostMult: 1.15,
  },
  {
    id: "predictive-breach-module",
    name: "Predictive Breach Module",
    kind: "weapon",
    tier: "advanced",
    shopPrice: null,
    description: "+6 pp when attack within 15 of defence. Successful reward −10%.",
    chanceWhenWithin: { window: 15, points: 6 },
    rewardMult: 0.9,
  },
  {
    id: "self-calibrating-assembly",
    name: "Self-Calibrating Assembly",
    kind: "weapon",
    tier: "advanced",
    shopPrice: null,
    description: "30% less durability loss, 20% lower repair cost. −5 Attack.",
    durabilityLossMult: 0.7,
    repairCostMult: 0.8,
    attackFlat: -5,
  },
  {
    id: "overdrive-mechanism",
    name: "Overdrive Mechanism",
    kind: "weapon",
    tier: "advanced",
    shopPrice: null,
    description: "+15 Attack. Two extra durability losses per heist.",
    attackFlat: 15,
    extraDurabilityLoss: 2,
  },
  {
    id: "overbuilt-frame",
    name: "Overbuilt Frame",
    kind: "weapon",
    tier: "advanced",
    shopPrice: null,
    description:
      "+20 maximum durability on the weapon. Removing this modification destroys it permanently — it will not return to inventory.",
    maxDurabilityBonus: 20,
    breaksOnRemove: true,
  },
];

/** Consumable territory cosmetics (crafted; applied from Territory). */
export const TERRITORY_MODS: TerritoryModDef[] = [
  {
    id: "sector-pigment-kit",
    name: "Sector Pigment Kit",
    kind: "territory",
    tier: "advanced",
    shopPrice: null,
    description:
      "Apply to one of your expanded sectors to paint it a custom map colour (15 options). Cannot match legend colours (home base green, default purple territory, NPC orange, other-player blue). Consumed on use.",
  },
];

export const VAULT_MODS: VaultModDef[] = [
  {
    id: "reinforced-vault-panels",
    name: "Reinforced Vault Panels",
    kind: "vault",
    tier: "basic",
    shopPrice: null,
    description: "+5 Defence. Craft in Workshop.",
    defenseFlat: 5,
  },
  {
    id: "motion-detection-grid",
    name: "Motion Detection Grid",
    kind: "vault",
    tier: "basic",
    shopPrice: null,
    description: "+4 effective Defence when attack advantage ≤ 10. Craft in Workshop.",
    defenseWhenAdvantageAtMost: { advantage: 10, defenseFlat: 4 },
  },
  {
    id: "access-control-system",
    name: "Access Control System",
    kind: "vault",
    tier: "basic",
    shopPrice: 50_000,
    description: "+8 effective Defence when weapon attack ≤ vault defence.",
    defenseWhenAttackNotAbove: 8,
  },
  {
    id: "emergency-lockdown",
    name: "Emergency Lockdown",
    kind: "vault",
    tier: "basic",
    shopPrice: 65_000,
    description: "+10 effective Defence for one eligible attack after activation. 24h cooldown.",
    emergencyLockdown: { defenseFlat: 10, cooldownMs: 24 * 60 * 60 * 1000 },
  },
  {
    id: "layered-barrier-system",
    name: "Layered Barrier System",
    kind: "vault",
    tier: "intermediate",
    shopPrice: null,
    description: "+12 Defence. Crafting only.",
    defenseFlat: 12,
  },
  {
    id: "adaptive-security-network",
    name: "Adaptive Security Network",
    kind: "vault",
    tier: "intermediate",
    shopPrice: null,
    description: "+8 Defence when attacker advantage > 15. Install material cost +10% (crafting).",
    defenseWhenAdvantageOver: { advantage: 15, defenseFlat: 8 },
    installMaterialCostMult: 1.1,
  },
  {
    id: "thermal-signature-masking",
    name: "Thermal Signature Masking",
    kind: "vault",
    tier: "intermediate",
    shopPrice: null,
    description: "Halves specialised attack bonuses (thermal/phase). No general Defence.",
    cutSpecialAttackBonusHalf: true,
  },
  {
    id: "automated-countermeasures",
    name: "Automated Countermeasures",
    kind: "vault",
    tier: "intermediate",
    shopPrice: null,
    description: "Successful heist reward against you −15%.",
    heistRewardMultOnSuccess: 0.85,
  },
  {
    id: "aegis-defence-core",
    name: "Aegis Defence Core",
    kind: "vault",
    tier: "advanced",
    shopPrice: null,
    description: "+18 Defence. Requires Exotic materials to craft.",
    defenseFlat: 18,
    requiresExotic: true,
  },
  {
    id: "predictive-security-matrix",
    name: "Predictive Security Matrix",
    kind: "vault",
    tier: "advanced",
    shopPrice: null,
    description: "Reduces positive attack advantage by 10 before probability. No even-match bonus.",
    reduceAdvantageBy: 10,
  },
  {
    id: "distributed-barrier-network",
    name: "Distributed Barrier Network",
    kind: "vault",
    tier: "advanced",
    shopPrice: null,
    description: "+12 Defence when ≥70% of vault balance is secured. Gold or Diamond vault.",
    defenseWhenSecuredPercentAtLeast: { percent: 70, defenseFlat: 12, minTier: "gold" },
  },
  {
    id: "blacksite-containment-system",
    name: "Blacksite Containment System",
    kind: "vault",
    tier: "advanced",
    shopPrice: null,
    description: "Eligible successful heist losses against you −20%.",
    lossReductionMult: 0.8,
  },
];

export function weaponModById(id: string) {
  return WEAPON_MODS.find((m) => m.id === id) ?? null;
}

export function vaultModById(id: string) {
  return VAULT_MODS.find((m) => m.id === id) ?? null;
}

export function territoryModById(id: string) {
  return TERRITORY_MODS.find((m) => m.id === id) ?? null;
}

export function weaponMaxDurabilityBonus(modIds: string[]): number {
  let n = 0;
  for (const id of modIds) n += weaponModById(id)?.maxDurabilityBonus ?? 0;
  return n;
}

export function isCareerId(value: string | null | undefined): value is CareerId {
  return Boolean(value && (CAREER_IDS as readonly string[]).includes(value));
}
