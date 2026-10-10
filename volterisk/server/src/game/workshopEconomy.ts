/** Materials, workshop, recipes, black market, territory claim fees. */

export type MaterialRarity = "common" | "uncommon" | "rare" | "exotic";

export const MATERIALS = [
  {
    id: "mat:scrap-components",
    name: "Scrap Components",
    rarity: "common" as const,
    refPrice: 100,
    sources: [
      "Work contracts paying under $15,000 → always ×3 on collect",
      "Successful heists: ~55% for ×2 (any take)",
      "Manufacturing Plant at 12:00 GMT: L1 ×3; L2 ×5; L3+ ×10 (Required property level of Manufacturing Plant)",
      "Black Market player listings",
    ],
  },
  {
    id: "mat:basic-fasteners",
    name: "Basic Fasteners",
    rarity: "common" as const,
    refPrice: 150,
    sources: [
      "Successful heists: ~40% for ×2 when take ≥ $8,000",
      "Manufacturing Plant at 12:00 GMT: L2 ×3; L3+ ×6 (Required property level of Manufacturing Plant)",
      "Black Market player listings",
    ],
  },
  {
    id: "mat:reinforced-alloy",
    name: "Reinforced Alloy",
    rarity: "uncommon" as const,
    refPrice: 500,
    sources: [
      "Work contracts paying $15,000–$49,999 → always ×2 on collect",
      "Successful heists: ~35% for ×1 when take ≥ $25,000",
      "Manufacturing Plant at 12:00 GMT: L2 ×1; L3+ ×2 (Required property level of Manufacturing Plant)",
      "Black Market player listings",
    ],
  },
  {
    id: "mat:precision-parts",
    name: "Precision Parts",
    rarity: "uncommon" as const,
    refPrice: 750,
    sources: [
      "Successful heists: ~28% for ×1 when take ≥ $60,000",
      "Manufacturing Plant at 12:00 GMT: L2 ×1; L3+ ×2 (Required property level of Manufacturing Plant)",
      "Black Market player listings",
    ],
  },
  {
    id: "mat:thermal-compound",
    name: "Thermal Compound",
    rarity: "uncommon" as const,
    refPrice: 900,
    sources: [
      "Warehouse daily yield at 12:00 GMT: ×1 at warehouse L4, ×2 at L5+, auto into Materials",
      "Black Market player listings",
    ],
  },
  {
    id: "mat:conductive-filament",
    name: "Conductive Filament",
    rarity: "rare" as const,
    refPrice: 2_500,
    sources: [
      "Work contracts paying $50,000+ → always ×1 on collect",
      "Successful heists: ~20% for ×1 when take ≥ $120,000",
      "Manufacturing Plant at 12:00 GMT: L4+ ×1 (Required property level of Manufacturing Plant)",
      "Black Market player listings",
    ],
  },
  {
    id: "mat:adaptive-circuitry",
    name: "Adaptive Circuitry",
    rarity: "rare" as const,
    refPrice: 3_500,
    sources: [
      "Hard / high-pay work contracts (same band as conductive drops when available)",
      "Manufacturing Plant at 12:00 GMT: L5 ×1 (Required property level of Manufacturing Plant)",
      "Black Market player listings",
      "Elite activities (see guide)",
    ],
  },
  {
    id: "mat:composite-weave",
    name: "Composite Weave",
    rarity: "rare" as const,
    refPrice: 4_000,
    sources: [
      "Garage daily yield at 12:00 GMT: ×1 at garage L1, +1 per garage level (L2 → ×2, …), auto into Materials",
      "Successful heists: ~12% for ×1 when take ≥ $250,000",
      "Black Market player listings",
    ],
  },
  {
    id: "mat:exotic-core",
    name: "Exotic Core",
    rarity: "exotic" as const,
    refPrice: 12_000,
    sources: [
      "Chop shop daily yield at 12:00 GMT: starts ×1 at L5, scales evenly to ×5 at L20 (Required property level of Chop Shop)",
      "Elite activities (see guide)",
      "Black Market player listings",
    ],
  },
  {
    id: "mat:phase-crystal",
    name: "Phase Crystal",
    rarity: "exotic" as const,
    refPrice: 18_000,
    sources: ["Elite activities (see guide)", "Black Market player listings"],
  },
  {
    id: "mat:predictive-processor",
    name: "Predictive Processor",
    rarity: "exotic" as const,
    refPrice: 22_000,
    sources: [
      "Elite activities (see guide)",
      "12% blueprint chance on work contracts paying $18,000+ can drop advanced blueprints (not this mat directly)",
      "Black Market player listings",
    ],
  },
] as const;

/** What “elite activities” means for material sourcing. */
export const ELITE_ACTIVITIES = [
  "Work contracts in the top payout band ($50,000+ collect) and other high-tier jobs on the board",
  "Successful heists with large takes ($120,000+; $250,000+ for composite weave rolls)",
  "Reputation milestones and sealed achievements that credit exotic mats when listed",
  "Daily specialized property yields at 12:00 GMT (chop shop → Exotic Core; garage → Composite Weave; manufacturing plant → parts ladder)",
  "Territory / late-game operations after Reputation level 11 (Diamond vault play, sector holdings)",
] as const;

export type PropertyMatDrop = { materialId: string; materialName: string; quantity: number };

/** Chop shop Exotic Core: none before L5; ×1 at L5; ×5 at L20; even steps in between. */
export function chopShopExoticQty(level: number): number {
  if (level < 5) return 0;
  if (level >= 20) return 5;
  return 1 + Math.floor(((level - 5) * 4) / 15);
}

/** Manufacturing Plant noon drops by property level (max L5). */
export function manufacturingPlantDrops(level: number): PropertyMatDrop[] {
  if (level < 1) return [];
  if (level === 1) {
    return [{ materialId: "mat:scrap-components", materialName: "Scrap Components", quantity: 3 }];
  }
  const scrap = level >= 3 ? 10 : 5;
  const fasteners = level >= 3 ? 6 : 3;
  const alloy = level >= 3 ? 2 : 1;
  const precision = level >= 3 ? 2 : 1;
  const drops: PropertyMatDrop[] = [
    { materialId: "mat:scrap-components", materialName: "Scrap Components", quantity: scrap },
    { materialId: "mat:basic-fasteners", materialName: "Basic Fasteners", quantity: fasteners },
    { materialId: "mat:reinforced-alloy", materialName: "Reinforced Alloy", quantity: alloy },
    { materialId: "mat:precision-parts", materialName: "Precision Parts", quantity: precision },
  ];
  if (level >= 4) {
    drops.push({ materialId: "mat:conductive-filament", materialName: "Conductive Filament", quantity: 1 });
  }
  if (level >= 5) {
    drops.push({ materialId: "mat:adaptive-circuitry", materialName: "Adaptive Circuitry", quantity: 1 });
  }
  return drops;
}

/**
 * Daily property material yields at 12:00 GMT.
 * drops(level) returns every stack to credit (empty = skip).
 */
export const PROPERTY_MATERIAL_YIELDS = [
  {
    catalogId: "chop-shop",
    txType: "mat_yield:chop-shop",
    title: "Chop shop delivery",
    drops: (level: number): PropertyMatDrop[] => {
      const n = chopShopExoticQty(level);
      return n > 0 ? [{ materialId: "mat:exotic-core", materialName: "Exotic Core", quantity: n }] : [];
    },
  },
  {
    catalogId: "garage",
    txType: "mat_yield:garage",
    title: "Garage delivery",
    drops: (level: number): PropertyMatDrop[] => {
      const n = level >= 1 ? level : 0;
      return n > 0
        ? [{ materialId: "mat:composite-weave", materialName: "Composite Weave", quantity: n }]
        : [];
    },
  },
  {
    catalogId: "warehouse",
    txType: "mat_yield:warehouse",
    title: "Warehouse delivery",
    drops: (level: number): PropertyMatDrop[] => {
      const n = level >= 5 ? 2 : level >= 4 ? 1 : 0;
      return n > 0
        ? [{ materialId: "mat:thermal-compound", materialName: "Thermal Compound", quantity: n }]
        : [];
    },
  },
  {
    catalogId: "manufacturing-plant",
    txType: "mat_yield:manufacturing-plant",
    title: "Manufacturing plant delivery",
    drops: manufacturingPlantDrops,
  },
] as const;

export function materialById(id: string) {
  return MATERIALS.find((m) => m.id === id) ?? null;
}

export const WORKSHOP = {
  CATALOG_ID: "workshop",
  /** Reputation level required to open the workshop. */
  MIN_REPUTATION: 5,
  MAX_LEVEL: 10,
  /** Simultaneous jobs by workshop level (index 0 unused). */
  JOB_SLOTS: [0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3] as number[],
  /** Crafting time reduction fraction by level; L10 = 40%. */
  TIME_REDUCTION: [0, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.38, 0.4] as number[],
  MIN_CRAFT_MS: 5 * 60_000,
  UPGRADES: {
    /** Cash doubled for upgrades from L1–7; L8–9 unchanged. Materials unchanged. */
    1: { cash: 600_000, common: 50, uncommon: 0, rare: 0, exotic: 0 },
    2: { cash: 1_200_000, common: 75, uncommon: 10, rare: 0, exotic: 0 },
    3: { cash: 2_100_000, common: 100, uncommon: 20, rare: 0, exotic: 0 },
    4: { cash: 3_300_000, common: 125, uncommon: 35, rare: 5, exotic: 0 },
    5: { cash: 2_000_000, common: 150, uncommon: 50, rare: 10, exotic: 0 },
    6: { cash: 3_000_000, common: 175, uncommon: 65, rare: 15, exotic: 0 },
    7: { cash: 6_630_000, common: 200, uncommon: 80, rare: 25, exotic: 2 },
    8: { cash: 4_680_000, common: 250, uncommon: 100, rare: 35, exotic: 5 },
    9: { cash: 6_825_000, common: 300, uncommon: 125, rare: 50, exotic: 10 },
  } as Record<number, { cash: number; common: number; uncommon: number; rare: number; exotic: number }>,
};

/** Refund of refundable resources by progress band. */
export const CRAFT_CANCEL_REFUND = [
  { under: 0.25, rate: 0.75 },
  { under: 0.75, rate: 0.5 },
  { under: 1, rate: 0.25 },
] as const;

export type CraftRecipe = {
  id: string;
  modId: string;
  name: string;
  kind: "weapon" | "vault" | "territory";
  tier: "basic" | "intermediate" | "advanced";
  workshopLevel: number;
  cash: number;
  baseMs: number;
  blueprint?: boolean;
  requiresProperties?: string[];
  materials: Record<string, number>;
};

/**
 * Custom territory map colours. Excludes legend: home #2e9e48, territory #7c3aed,
 * NPC #c45c26, player #2f5f9e (and their darker pin variants).
 */
export const TERRITORY_MAP_COLORS = [
  { id: "crimson", hex: "#b91c1c", label: "Crimson" },
  { id: "rose", hex: "#e11d48", label: "Rose" },
  { id: "amber", hex: "#d97706", label: "Amber" },
  { id: "gold", hex: "#ca8a04", label: "Gold" },
  { id: "lime", hex: "#65a30d", label: "Lime" },
  { id: "teal", hex: "#0d9488", label: "Teal" },
  { id: "cyan", hex: "#0891b2", label: "Cyan" },
  { id: "sky", hex: "#0284c7", label: "Sky" },
  { id: "indigo", hex: "#4338ca", label: "Indigo" },
  { id: "magenta", hex: "#c026d3", label: "Magenta" },
  { id: "pink", hex: "#db2777", label: "Pink" },
  { id: "slate", hex: "#475569", label: "Slate" },
  { id: "stone", hex: "#78716c", label: "Stone" },
  { id: "ink", hex: "#171717", label: "Ink" },
  { id: "chartreuse", hex: "#a3e635", label: "Chartreuse" },
] as const;

export type TerritoryMapColorId = (typeof TERRITORY_MAP_COLORS)[number]["id"];

export function territoryMapColorById(id: string) {
  return TERRITORY_MAP_COLORS.find((c) => c.id === id) ?? null;
}

function mats(common: number, uncommon: number, rare: number, exotic: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (common > 0) {
    out["mat:scrap-components"] = Math.ceil(common * 0.6);
    out["mat:basic-fasteners"] = Math.floor(common * 0.4);
  }
  if (uncommon > 0) {
    out["mat:reinforced-alloy"] = Math.ceil(uncommon * 0.4);
    out["mat:precision-parts"] = Math.ceil(uncommon * 0.35);
    out["mat:thermal-compound"] = Math.floor(uncommon * 0.25);
  }
  if (rare > 0) {
    out["mat:conductive-filament"] = Math.ceil(rare * 0.4);
    out["mat:adaptive-circuitry"] = Math.ceil(rare * 0.35);
    out["mat:composite-weave"] = Math.floor(rare * 0.25);
  }
  if (exotic > 0) {
    out["mat:exotic-core"] = Math.ceil(exotic * 0.4);
    out["mat:phase-crystal"] = Math.ceil(exotic * 0.35);
    out["mat:predictive-processor"] = Math.floor(exotic * 0.25) || (exotic > 0 ? 1 : 0);
  }
  return out;
}

/** Cut early-recipe stacks in half (round up, minimum 1). */
function halfMats(input: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(input).map(([id, n]) => [id, Math.max(1, Math.ceil(n / 2))]),
  );
}

const H = 3_600_000;
const M20 = 20 * 60_000;

/** Three named stacks — workshop level 1 basics (halved from 5). */
const BASIC_L1_MATS: Record<string, number> = {
  "mat:scrap-components": 3,
  "mat:basic-fasteners": 3,
  "mat:reinforced-alloy": 3,
};

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: "craft:reinforced-grip",
    modId: "reinforced-grip",
    name: "Reinforced Grip",
    kind: "weapon",
    tier: "basic",
    workshopLevel: 1,
    cash: 3_000,
    baseMs: M20,
    materials: { ...BASIC_L1_MATS },
  },
  {
    id: "craft:wear-guard",
    modId: "wear-guard",
    name: "Wear Guard",
    kind: "weapon",
    tier: "basic",
    workshopLevel: 1,
    cash: 3_000,
    baseMs: M20,
    materials: { ...BASIC_L1_MATS },
  },
  {
    id: "craft:reinforced-vault-panels",
    modId: "reinforced-vault-panels",
    name: "Reinforced Vault Panels",
    kind: "vault",
    tier: "basic",
    workshopLevel: 2,
    cash: 3_000,
    baseMs: M20,
    materials: { ...BASIC_L1_MATS },
  },
  {
    id: "craft:motion-detection-grid",
    modId: "motion-detection-grid",
    name: "Motion Detection Grid",
    kind: "vault",
    tier: "basic",
    workshopLevel: 2,
    cash: 3_000,
    baseMs: M20,
    materials: { ...BASIC_L1_MATS },
  },
  { id: "craft:kinetic-amplifier", modId: "kinetic-amplifier", name: "Kinetic Amplifier", kind: "weapon", tier: "intermediate", workshopLevel: 3, cash: 20_000, baseMs: 2 * H, materials: halfMats(mats(30, 10, 3, 0)) },
  { id: "craft:adaptive-lock-interface", modId: "adaptive-lock-interface", name: "Adaptive Lock Interface", kind: "weapon", tier: "intermediate", workshopLevel: 3, cash: 22_000, baseMs: 2 * H, materials: halfMats(mats(25, 15, 3, 0)) },
  { id: "craft:composite-reinforcement", modId: "composite-reinforcement", name: "Composite Reinforcement", kind: "weapon", tier: "intermediate", workshopLevel: 4, cash: 25_000, baseMs: 3 * H, materials: halfMats(mats(40, 15, 5, 0)), requiresProperties: ["garage"] },
  { id: "craft:thermal-regulator", modId: "thermal-regulator", name: "Thermal Regulator", kind: "weapon", tier: "intermediate", workshopLevel: 4, cash: 28_000, baseMs: 3 * H, materials: halfMats(mats(30, 20, 5, 0)) },
  { id: "craft:layered-barrier-system", modId: "layered-barrier-system", name: "Layered Barrier System", kind: "vault", tier: "intermediate", workshopLevel: 4, cash: 30_000, baseMs: 3 * H, materials: halfMats(mats(40, 20, 8, 0)), requiresProperties: ["warehouse"] },
  { id: "craft:adaptive-security-network", modId: "adaptive-security-network", name: "Adaptive Security Network", kind: "vault", tier: "intermediate", workshopLevel: 5, cash: 35_000, baseMs: 4 * H, materials: halfMats(mats(40, 25, 10, 0)) },
  { id: "craft:thermal-signature-masking", modId: "thermal-signature-masking", name: "Thermal Signature Masking", kind: "vault", tier: "intermediate", workshopLevel: 5, cash: 32_000, baseMs: 4 * H, materials: halfMats(mats(30, 20, 10, 0)) },
  { id: "craft:automated-countermeasures", modId: "automated-countermeasures", name: "Automated Countermeasures", kind: "vault", tier: "intermediate", workshopLevel: 5, cash: 40_000, baseMs: 5 * H, materials: halfMats(mats(35, 25, 12, 0)), requiresProperties: ["front"] },
  { id: "craft:phase-alignment-core", modId: "phase-alignment-core", name: "Phase Alignment Core", kind: "weapon", tier: "advanced", workshopLevel: 7, cash: 75_000, baseMs: 8 * H, blueprint: true, materials: mats(50, 25, 15, 2) },
  { id: "craft:predictive-breach-module", modId: "predictive-breach-module", name: "Predictive Breach Module", kind: "weapon", tier: "advanced", workshopLevel: 7, cash: 85_000, baseMs: 10 * H, blueprint: true, materials: mats(40, 30, 15, 3), requiresProperties: ["front"] },
  { id: "craft:self-calibrating-assembly", modId: "self-calibrating-assembly", name: "Self-Calibrating Assembly", kind: "weapon", tier: "advanced", workshopLevel: 8, cash: 90_000, baseMs: 10 * H, blueprint: true, materials: mats(50, 30, 20, 3), requiresProperties: ["garage"] },
  { id: "craft:overdrive-mechanism", modId: "overdrive-mechanism", name: "Overdrive Mechanism", kind: "weapon", tier: "advanced", workshopLevel: 8, cash: 100_000, baseMs: 12 * H, blueprint: true, materials: mats(50, 30, 20, 4) },
  { id: "craft:aegis-defence-core", modId: "aegis-defence-core", name: "Aegis Defence Core", kind: "vault", tier: "advanced", workshopLevel: 7, cash: 90_000, baseMs: 10 * H, blueprint: true, materials: mats(50, 30, 20, 3) },
  { id: "craft:predictive-security-matrix", modId: "predictive-security-matrix", name: "Predictive Security Matrix", kind: "vault", tier: "advanced", workshopLevel: 8, cash: 110_000, baseMs: 12 * H, blueprint: true, materials: mats(50, 35, 20, 4), requiresProperties: ["front"] },
  { id: "craft:distributed-barrier-network", modId: "distributed-barrier-network", name: "Distributed Barrier Network", kind: "vault", tier: "advanced", workshopLevel: 9, cash: 125_000, baseMs: 14 * H, blueprint: true, materials: mats(60, 40, 25, 5), requiresProperties: ["warehouse"] },
  { id: "craft:blacksite-containment-system", modId: "blacksite-containment-system", name: "Blacksite Containment System", kind: "vault", tier: "advanced", workshopLevel: 9, cash: 140_000, baseMs: 16 * H, blueprint: true, materials: mats(60, 40, 25, 6) },
  {
    id: "craft:sector-pigment-kit",
    modId: "sector-pigment-kit",
    name: "Sector Pigment Kit",
    kind: "territory",
    tier: "advanced",
    workshopLevel: 10,
    cash: 165_000,
    baseMs: 18 * H,
    blueprint: true,
    requiresProperties: ["estate"],
    materials: mats(70, 48, 32, 8),
  },
  {
    id: "craft:overbuilt-frame",
    modId: "overbuilt-frame",
    name: "Overbuilt Frame",
    kind: "weapon",
    tier: "advanced",
    workshopLevel: 10,
    cash: 180_000,
    baseMs: 20 * H,
    blueprint: true,
    requiresProperties: ["garage", "chop-shop"],
    materials: mats(75, 50, 35, 9),
  },
];

export function recipeById(id: string) {
  return CRAFT_RECIPES.find((r) => r.id === id) ?? null;
}

export function blueprintItemId(modId: string) {
  return `bp:${modId}`;
}

export const BLACK_MARKET = {
  FEE_RATE: 0.05,
  LISTING_MS: 7 * 24 * 60 * 60 * 1000,
  WEAPON_MIN_DURABILITY_RATIO: 0.2,
};

/**
 * Fee to claim the Nth sector (headquarters = 1).
 * Slot 2 (first expansion) is free. Slot 3+ charge as below.
 * Also: first claim after reaching Level 15 while still on only HQ+0 expansions
 * stays free (same as slot 2). Confirmed ladder: 3→$3M, 4→$8M, 5→$15M.
 */
export const TERRITORY_CLAIM_FEES: Record<number, number> = {
  2: 0,
  3: 3_000_000,
  4: 8_000_000,
  5: 15_000_000,
};

/** Resolve claim fee; Level 15+ players still get the first expansion free. */
export function territoryClaimFee(nextSlot: number, _reputationLevel: number): number {
  if (nextSlot <= 2) return 0;
  return TERRITORY_CLAIM_FEES[nextSlot] ?? 0;
}

export function materialsByRarity(rarity: MaterialRarity) {
  return MATERIALS.filter((m) => m.rarity === rarity);
}

/** Heist loot bands — chance rolls after a successful take. */
export const HEIST_MATERIAL_DROPS = [
  { minStolen: 0, chance: 0.55, id: "mat:scrap-components", n: 2 },
  { minStolen: 8_000, chance: 0.4, id: "mat:basic-fasteners", n: 2 },
  { minStolen: 25_000, chance: 0.35, id: "mat:reinforced-alloy", n: 1 },
  { minStolen: 60_000, chance: 0.28, id: "mat:precision-parts", n: 1 },
  { minStolen: 120_000, chance: 0.2, id: "mat:conductive-filament", n: 1 },
  { minStolen: 250_000, chance: 0.12, id: "mat:composite-weave", n: 1 },
] as const;

export function rollHeistMaterials(amountStolen: number): { id: string; name: string; quantity: number }[] {
  const out: { id: string; name: string; quantity: number }[] = [];
  for (const row of HEIST_MATERIAL_DROPS) {
    if (amountStolen < row.minStolen) continue;
    if (Math.random() > row.chance) continue;
    const mat = materialById(row.id);
    if (!mat) continue;
    out.push({ id: row.id, name: mat.name, quantity: row.n });
  }
  if (out.length === 0 && amountStolen > 0 && Math.random() < 0.35) {
    const mat = materialById("mat:scrap-components");
    if (mat) out.push({ id: mat.id, name: mat.name, quantity: 1 });
  }
  return out;
}

/** Contract material drop rates (documented for help UI). */
export const CONTRACT_MATERIAL_RATES = {
  easy: { id: "mat:scrap-components", n: 3, note: "Reward under $15k → Scrap Components ×3" },
  moderate: { id: "mat:reinforced-alloy", n: 2, note: "Reward $15k–$49k → Reinforced Alloy ×2" },
  hard: { id: "mat:conductive-filament", n: 1, note: "Reward $50k+ → Conductive Filament ×1" },
  blueprintChance: 0.12,
  blueprintMinReward: 18_000,
} as const;

/** Spend rarity buckets across owned stacks (common/uncommon/rare/exotic counts). */
export function raritySpendPlan(
  owned: Record<string, number>,
  need: { common: number; uncommon: number; rare: number; exotic: number },
): Record<string, number> | null {
  const plan: Record<string, number> = {};
  const take = (rarity: MaterialRarity, amount: number) => {
    let left = amount;
    for (const m of materialsByRarity(rarity)) {
      if (left <= 0) break;
      const have = owned[m.id] ?? 0;
      const use = Math.min(have, left);
      if (use > 0) {
        plan[m.id] = (plan[m.id] ?? 0) + use;
        left -= use;
      }
    }
    return left <= 0;
  };
  if (!take("common", need.common)) return null;
  if (!take("uncommon", need.uncommon)) return null;
  if (!take("rare", need.rare)) return null;
  if (!take("exotic", need.exotic)) return null;
  return plan;
}
