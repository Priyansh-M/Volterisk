/**
 * Levels 12–50. Conditions match the design tables (properties, plant, craft, heists, vault).
 */

export type RepCondition = {
  kind: "asset" | "passive" | "cash" | "vault" | "vaultTier" | "heists" | "contracts" | "territory" | "weaponLevel" | "craft";
  id?: string;
  minLevel?: number;
  min?: number;
  tier?: string;
  label: string;
};

export type ReputationRung = {
  level: number;
  reward: number;
  fee?: number;
  unlocks?: string[];
  milestone?: boolean;
  conditions: RepCondition[];
};

const LEVEL_UP_REWARD = 100_000;
const MILESTONES = new Set([15, 20, 25, 30, 35, 40, 45, 50]);

const UNLOCKS: Record<number, string[]> = {
  15: ["Vault modification slot 1", "Weapon modification slot 1"],
  20: ["Vault modification slot 2"],
  25: ["Territory capacity 3", "Weapon modification slot 2", "Vault modification slot 3"],
  30: ["Secondary career specialisation"],
  35: ["Vault modification slot 4", "Weapon modification slot 3"],
  40: ["Territory capacity 4"],
  45: ["Underworld Elite standing"],
  50: ["Territory capacity 5", "Maximum standing"],
};

const LABEL: Record<string, string> = {
  garage: "Garage",
  car: "Car",
  hangar: "Hangar",
  airplane: "Airplane",
  dock: "Dock",
  speedboat: "Speedboat",
  helipad: "Helipad",
  helicopter: "Helicopter",
  warehouse: "Warehouse",
  truck: "Truck",
  front: "Front business",
  bike: "Bike",
  "chop-shop": "Chop shop",
  "armored-van": "Armored van",
  casino: "Casino",
  limousine: "Limousine",
  estate: "Estate",
  yacht: "Yacht",
  safehouse: "Safehouse",
  caravan: "Caravan",
  "manufacturing-plant": "Manufacturing Plant",
};

function moneyLabel(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

function asset(id: string, minLevel: number): RepCondition {
  return {
    kind: "asset",
    id,
    minLevel,
    label: `${LABEL[id] ?? id} at least level ${minLevel}`,
  };
}

function plant(minLevel: number, note?: string): RepCondition {
  return {
    kind: "asset",
    id: "manufacturing-plant",
    minLevel,
    label: note ?? `Manufacturing Plant at least level ${minLevel}`,
  };
}

function craft(modId: string, name: string): RepCondition {
  return {
    kind: "craft",
    id: modId,
    min: 1,
    label: `Craft ${name} in the Workshop (ticks if already crafted)`,
  };
}

function heists(n: number): RepCondition {
  return {
    kind: "heists",
    min: n,
    label: `Complete ${n} successful heists since this reputation level`,
  };
}

/** Minimum vault *balance* only — does not touch capacity (still unlimited on Diamond L5 + card). */
function vault(min: number): RepCondition {
  return { kind: "vault", min, label: `Hold at least ${moneyLabel(min)} vault money` };
}

/** L20 = $5,000,000; each later level is +$500,000 over the previous. */
function vaultFrom20(level: number): number {
  return 5_000_000 + (level - 20) * 500_000;
}

type Row = {
  props: [string, number][];
  plant: number;
  plantNote?: string;
  craft?: [string, string];
  heists?: number;
  vault: number;
  diamondL5?: boolean;
};

/** Explicit L12–50 design table. */
const TABLE: Record<number, Row> = {
  12: {
    diamondL5: true,
    props: [
      ["warehouse", 12],
      ["garage", 12],
      ["front", 12],
    ],
    plant: 1,
    plantNote: "Own Manufacturing Plant level 1",
    heists: 28,
    vault: 1_000_000,
  },
  13: {
    props: [
      ["hangar", 12],
      ["airplane", 12],
      ["warehouse", 10],
    ],
    plant: 1,
    heists: 28,
    vault: 1_300_000,
  },
  14: {
    props: [
      ["dock", 12],
      ["speedboat", 12],
      ["front", 10],
    ],
    plant: 1,
    craft: ["reinforced-grip", "Reinforced Grip"],
    heists: 28,
    vault: 1_600_000,
  },
  15: {
    props: [
      ["helipad", 16],
      ["helicopter", 16],
      ["chop-shop", 14],
    ],
    plant: 2,
    plantNote: "Upgrade Manufacturing Plant to level 2",
    craft: ["wear-guard", "Wear Guard"],
    heists: 46,
    vault: 1_900_000,
  },
  16: {
    props: [
      ["warehouse", 14],
      ["truck", 14],
      ["casino", 10],
    ],
    plant: 2,
    craft: ["reinforced-vault-panels", "Reinforced Vault Panels"],
    vault: 2_200_000,
  },
  17: {
    props: [
      ["front", 14],
      ["bike", 14],
      ["estate", 12],
    ],
    plant: 2,
    craft: ["motion-detection-grid", "Motion Detection Grid"],
    heists: 39,
    vault: 2_600_000,
  },
  18: {
    props: [
      ["chop-shop", 16],
      ["armored-van", 16],
      ["safehouse", 14],
    ],
    plant: 2,
    craft: ["kinetic-amplifier", "Kinetic Amplifier"],
    heists: 42,
    vault: 2_900_000,
  },
  19: {
    props: [
      ["casino", 16],
      ["limousine", 16],
      ["garage", 14],
    ],
    plant: 2,
    craft: ["adaptive-lock-interface", "Adaptive Lock Interface"],
    heists: 46,
    vault: 3_200_000,
  },
  20: {
    props: [
      ["estate", 18],
      ["yacht", 18],
      ["hangar", 16],
    ],
    plant: 3,
    plantNote: "Upgrade Manufacturing Plant to level 3",
    craft: ["layered-barrier-system", "Layered Barrier System"],
    heists: 30,
    vault: vaultFrom20(20),
  },
  21: {
    props: [
      ["safehouse", 18],
      ["caravan", 18],
      ["dock", 14],
    ],
    plant: 3,
    craft: ["thermal-regulator", "Thermal Regulator"],
    heists: 30,
    vault: vaultFrom20(21),
  },
  22: {
    props: [
      ["garage", 18],
      ["car", 18],
      ["helipad", 16],
    ],
    plant: 3,
    craft: ["reinforced-grip", "Reinforced Grip"],
    heists: 30,
    vault: vaultFrom20(22),
  },
  23: {
    props: [
      ["hangar", 18],
      ["airplane", 18],
      ["warehouse", 16],
    ],
    plant: 3,
    craft: ["wear-guard", "Wear Guard"],
    heists: 30,
    vault: vaultFrom20(23),
  },
  24: {
    props: [
      ["dock", 20],
      ["speedboat", 20],
      ["front", 18],
    ],
    plant: 3,
    craft: ["reinforced-vault-panels", "Reinforced Vault Panels"],
    heists: 30,
    vault: vaultFrom20(24),
  },
  25: {
    props: [
      ["helipad", 20],
      ["helicopter", 20],
      ["chop-shop", 20],
    ],
    plant: 3,
    craft: ["motion-detection-grid", "Motion Detection Grid"],
    heists: 30,
    vault: vaultFrom20(25),
  },
  26: {
    props: [
      ["warehouse", 20],
      ["truck", 20],
      ["casino", 16],
    ],
    plant: 3,
    craft: ["kinetic-amplifier", "Kinetic Amplifier"],
    heists: 30,
    vault: vaultFrom20(26),
  },
  27: {
    props: [
      ["front", 20],
      ["bike", 20],
      ["estate", 20],
    ],
    plant: 3,
    craft: ["adaptive-lock-interface", "Adaptive Lock Interface"],
    heists: 30,
    vault: vaultFrom20(27),
  },
  28: {
    props: [
      ["chop-shop", 20],
      ["armored-van", 20],
      ["safehouse", 20],
    ],
    plant: 3,
    craft: ["layered-barrier-system", "Layered Barrier System"],
    heists: 30,
    vault: vaultFrom20(28),
  },
  29: {
    props: [
      ["casino", 20],
      ["limousine", 20],
      ["garage", 20],
    ],
    plant: 3,
    craft: ["thermal-regulator", "Thermal Regulator"],
    heists: 30,
    vault: vaultFrom20(29),
  },
  30: {
    props: [
      ["estate", 20],
      ["yacht", 20],
      ["hangar", 20],
    ],
    plant: 4,
    plantNote: "Upgrade Manufacturing Plant to level 4",
    craft: ["reinforced-grip", "Reinforced Grip"],
    heists: 30,
    vault: vaultFrom20(30),
  },
  31: {
    props: [
      ["safehouse", 20],
      ["caravan", 20],
      ["dock", 20],
    ],
    plant: 4,
    craft: ["wear-guard", "Wear Guard"],
    heists: 30,
    vault: vaultFrom20(31),
  },
  32: {
    props: [
      ["garage", 20],
      ["car", 20],
      ["helipad", 20],
    ],
    plant: 4,
    craft: ["reinforced-vault-panels", "Reinforced Vault Panels"],
    heists: 30,
    vault: vaultFrom20(32),
  },
  33: {
    props: [
      ["hangar", 20],
      ["airplane", 20],
      ["warehouse", 20],
    ],
    plant: 4,
    craft: ["motion-detection-grid", "Motion Detection Grid"],
    heists: 30,
    vault: vaultFrom20(33),
  },
  34: {
    props: [
      ["dock", 20],
      ["speedboat", 20],
      ["front", 20],
    ],
    plant: 4,
    craft: ["kinetic-amplifier", "Kinetic Amplifier"],
    heists: 30,
    vault: vaultFrom20(34),
  },
  35: {
    props: [
      ["helipad", 20],
      ["helicopter", 20],
      ["chop-shop", 20],
    ],
    plant: 4,
    craft: ["adaptive-lock-interface", "Adaptive Lock Interface"],
    heists: 30,
    vault: vaultFrom20(35),
  },
  36: {
    props: [
      ["warehouse", 20],
      ["truck", 20],
      ["casino", 20],
    ],
    plant: 4,
    craft: ["layered-barrier-system", "Layered Barrier System"],
    heists: 30,
    vault: vaultFrom20(36),
  },
  37: {
    props: [
      ["front", 20],
      ["bike", 20],
      ["estate", 20],
    ],
    plant: 4,
    craft: ["thermal-regulator", "Thermal Regulator"],
    heists: 30,
    vault: vaultFrom20(37),
  },
  38: {
    props: [
      ["chop-shop", 20],
      ["armored-van", 20],
      ["safehouse", 20],
    ],
    plant: 4,
    craft: ["reinforced-grip", "Reinforced Grip"],
    heists: 30,
    vault: vaultFrom20(38),
  },
  39: {
    props: [
      ["casino", 20],
      ["limousine", 20],
      ["garage", 20],
    ],
    plant: 4,
    craft: ["wear-guard", "Wear Guard"],
    heists: 30,
    vault: vaultFrom20(39),
  },
  40: {
    props: [
      ["estate", 20],
      ["yacht", 20],
      ["hangar", 20],
    ],
    plant: 5,
    plantNote: "Upgrade Manufacturing Plant to level 5 (maximum)",
    craft: ["reinforced-vault-panels", "Reinforced Vault Panels"],
    heists: 30,
    vault: vaultFrom20(40),
  },
  41: {
    props: [
      ["safehouse", 20],
      ["caravan", 20],
      ["dock", 20],
    ],
    plant: 5,
    craft: ["motion-detection-grid", "Motion Detection Grid"],
    heists: 30,
    vault: vaultFrom20(41),
  },
  42: {
    props: [
      ["garage", 20],
      ["car", 20],
      ["helipad", 20],
    ],
    plant: 5,
    craft: ["kinetic-amplifier", "Kinetic Amplifier"],
    heists: 30,
    vault: vaultFrom20(42),
  },
  43: {
    props: [
      ["hangar", 20],
      ["airplane", 20],
      ["warehouse", 20],
    ],
    plant: 5,
    craft: ["adaptive-lock-interface", "Adaptive Lock Interface"],
    heists: 30,
    vault: vaultFrom20(43),
  },
  44: {
    props: [
      ["dock", 20],
      ["speedboat", 20],
      ["front", 20],
    ],
    plant: 5,
    craft: ["layered-barrier-system", "Layered Barrier System"],
    heists: 30,
    vault: vaultFrom20(44),
  },
  45: {
    props: [
      ["helipad", 20],
      ["helicopter", 20],
      ["chop-shop", 20],
    ],
    plant: 5,
    craft: ["thermal-regulator", "Thermal Regulator"],
    heists: 30,
    vault: vaultFrom20(45),
  },
  46: {
    props: [
      ["warehouse", 20],
      ["truck", 20],
      ["casino", 20],
    ],
    plant: 5,
    craft: ["reinforced-grip", "Reinforced Grip"],
    heists: 30,
    vault: vaultFrom20(46),
  },
  47: {
    props: [
      ["front", 20],
      ["bike", 20],
      ["estate", 20],
    ],
    plant: 5,
    craft: ["wear-guard", "Wear Guard"],
    heists: 30,
    vault: vaultFrom20(47),
  },
  48: {
    props: [
      ["chop-shop", 20],
      ["armored-van", 20],
      ["safehouse", 20],
    ],
    plant: 5,
    craft: ["reinforced-vault-panels", "Reinforced Vault Panels"],
    heists: 30,
    vault: vaultFrom20(48),
  },
  49: {
    props: [
      ["casino", 20],
      ["limousine", 20],
      ["garage", 20],
    ],
    plant: 5,
    craft: ["motion-detection-grid", "Motion Detection Grid"],
    heists: 30,
    vault: vaultFrom20(49),
  },
  50: {
    props: [
      ["estate", 20],
      ["yacht", 20],
      ["hangar", 20],
    ],
    plant: 5,
    craft: ["kinetic-amplifier", "Kinetic Amplifier"],
    heists: 30,
    vault: vaultFrom20(50),
  },
};

function conditionsFor(level: number): RepCondition[] {
  const row = TABLE[level];
  if (!row) return [];
  const out: RepCondition[] = [];
  if (row.diamondL5) {
    out.push({
      kind: "vaultTier",
      tier: "diamond",
      minLevel: 5,
      label: "Diamond Vault Level 5",
    });
  }
  for (const [id, minLevel] of row.props) out.push(asset(id, minLevel));
  out.push(plant(row.plant, row.plantNote));
  if (row.craft) out.push(craft(row.craft[0], row.craft[1]));
  if (row.heists != null) out.push(heists(row.heists));
  out.push(vault(row.vault));
  return out;
}

export function buildLateReputation(): ReputationRung[] {
  const out: ReputationRung[] = [];
  for (let level = 12; level <= 50; level += 1) {
    out.push({
      level,
      reward: LEVEL_UP_REWARD,
      milestone: MILESTONES.has(level),
      unlocks: UNLOCKS[level] ?? [],
      conditions: conditionsFor(level),
    });
  }
  return out;
}

export const LATE_LEVEL_REWARD = LEVEL_UP_REWARD;
