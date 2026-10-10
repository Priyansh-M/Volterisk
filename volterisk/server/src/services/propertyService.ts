import { GameError } from "../game/errors.js";
import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { chargeSpend, type Tx } from "./economyService.js";

async function chargeMarket(tx: Tx, userId: string, amount: number): Promise<"cash" | "card"> {
  return chargeSpend(tx, userId, amount);
}

export const ASSET_MAX_LEVEL = RULES.PROPERTY_MAX_LEVEL;

/** Manufacturing Plant: L1→2 $250k, then +$50k each step (max L5). */
export const MANUFACTURING_PLANT_MAX_LEVEL = 5;
export const MANUFACTURING_PLANT_MIN_REPUTATION = 12;

export type AssetDef = {
  id: string;
  name: string;
  price: number;
  kind: "property" | "vehicle";
  note: string;
  minReputation?: number;
  maxLevel?: number;
};

export const ASSETS: AssetDef[] = [
  { id: "workshop", name: "Workshop", price: 0, kind: "property", note: "Autogranted level 1 bench. Craft intermediate and advanced modifications here." },
  { id: "garage", name: "Garage", price: 20_000, kind: "property", note: "One bay, a pit, and a door that sticks. Needed before a car counts for work." },
  { id: "safehouse", name: "Safehouse", price: 30_000, kind: "property", note: "A rented room with a second stair and no name on the bell." },
  { id: "hangar", name: "Hangar", price: 50_000, kind: "property", note: "Corrugated roof, oil on the concrete, room for a wing." },
  { id: "caravan", name: "Caravan", price: 50_000, kind: "property", note: "A tin house on a hitch. It can be gone by morning." },
  { id: "warehouse", name: "Warehouse", price: 100_000, kind: "property", note: "Empty floor, a loading dock, and a lock the crew already knows." },
  { id: "front", name: "Front Business", price: 100_000, kind: "property", note: "A street counter. The books in the drawer are the real stock." },
  { id: "car", name: "Car", price: 35_000, kind: "vehicle", note: "A dull sedan. Plates that do not come back to you." },
  { id: "bike", name: "Bike", price: 20_000, kind: "vehicle", note: "Narrow enough for the alleys the sedan will not take." },
  { id: "truck", name: "Truck", price: 75_000, kind: "vehicle", note: "A box that fits a job, a crew, or a safe." },
  { id: "airplane", name: "Airplane", price: 135_000, kind: "vehicle", note: "Single prop. It needs the hangar and a dark strip." },
  { id: "dock", name: "Dock", price: 120_000, kind: "property", note: "Pilings, a cleat, and a light that stays off." },
  { id: "speedboat", name: "Speedboat", price: 165_000, kind: "vehicle", note: "Shallow draft. Off the dock before a car reaches the pier." },
  { id: "helipad", name: "Helipad", price: 180_000, kind: "property", note: "A painted circle on a roof that can take the weight." },
  { id: "helicopter", name: "Helicopter", price: 300_000, kind: "vehicle", note: "No runway. It still needs the pad and a pilot who does not talk." },
  { id: "chop-shop", name: "Chop Shop", price: 250_000, kind: "property", note: "A bay that takes plates, VINs, and questions off a car." },
  { id: "armored-van", name: "Armored Van", price: 220_000, kind: "vehicle", note: "Thick doors, small windows, slow on a hill." },
  { id: "casino", name: "Casino", price: 400_000, kind: "property", note: "Tables up front. The count happens in the room behind the cage." },
  { id: "limousine", name: "Limousine", price: 350_000, kind: "vehicle", note: "A long car with a screen between you and the driver." },
  { id: "estate", name: "Estate", price: 750_000, kind: "property", note: "A gate, a drive, and no neighbor close enough to hear a door." },
  { id: "yacht", name: "Yacht", price: 800_000, kind: "vehicle", note: "A hull that can hold the books and leave the harbor." },
  {
    id: "manufacturing-plant",
    name: "Manufacturing Plant",
    price: 5_000_000,
    kind: "property",
    note: "Reputation 12+. Noon GMT parts line — scrap at L1, full ladder by L5. Each upgrade $900,000.",
    minReputation: MANUFACTURING_PLANT_MIN_REPUTATION,
    maxLevel: MANUFACTURING_PLANT_MAX_LEVEL,
  },
];

export type AssetKind = AssetDef["kind"];

export function assetById(id: string) {
  return ASSETS.find((item) => item.id === id) ?? null;
}

function assetCap(catalogId: string, item?: AssetDef | null): number {
  if (catalogId === "workshop") return 10;
  return item?.maxLevel ?? ASSET_MAX_LEVEL;
}

function baseAssetUpgradeCost(price: number, currentLevel: number, cap: number): number | null {
  if (currentLevel < 1 || currentLevel >= cap) return null;
  const nextLevel = currentLevel + 1;
  if (currentLevel >= RULES.PROPERTY_LEGACY_MAX_LEVEL) {
    const growth = RULES.PROPERTY_UPGRADE_GROWTH;
    const mult = RULES.PROPERTY_UPGRADE_MILESTONE_MULT[nextLevel] ?? 1;
    return Math.ceil(price * growth ** (nextLevel - 1) * mult);
  }
  let previous = 0;
  let cost = 0;
  for (let step = 1; step <= currentLevel; step += 1) {
    cost = step === 1 ? price / 5 : (price + previous) / 5;
    previous = cost;
  }
  const priced = Math.round(cost);
  return currentLevel >= 2 ? priced * 2 : priced;
}

/**
 * Extra cost for upgrades past the L10 reputation asset baseline.
 * First step past baseline: +$200k; each further step: +$50k more.
 * Manufacturing Plant is excluded (flat $900k).
 */
export function postL10UpgradeSurcharge(catalogId: string | undefined, currentLevel: number): number {
  if (!catalogId || catalogId === "manufacturing-plant" || catalogId === "workshop") return 0;
  const baseline = RULES.L10_ASSET_LEVEL_BASELINE[catalogId];
  if (baseline == null) return 0;
  const nextLevel = currentLevel + 1;
  if (nextLevel <= baseline) return 0;
  const stepsPast = nextLevel - baseline; // 1 on first post-baseline upgrade
  return RULES.POST_L10_UPGRADE_BASE + (stepsPast - 1) * RULES.POST_L10_UPGRADE_STEP;
}

/**
 * Levels 1–10: legacy curve (purchase/5 chain, doubled from level 2 upgrades).
 * Levels 11–20: ceil(BaseCost × 1.45^(nextLevel-1) × milestoneMult).
 * Manufacturing Plant: flat $900k. Post–L10 baseline upgrades add surcharge.
 */
export function assetUpgradeCost(price: number, currentLevel: number, catalogId?: string): number | null {
  if (catalogId === "manufacturing-plant") {
    if (currentLevel < 1 || currentLevel >= MANUFACTURING_PLANT_MAX_LEVEL) return null;
    return 900_000;
  }
  const cap = catalogId ? assetCap(catalogId, assetById(catalogId)) : ASSET_MAX_LEVEL;
  const base = baseAssetUpgradeCost(price, currentLevel, cap);
  if (base == null) return null;
  return base + postL10UpgradeSurcharge(catalogId, currentLevel);
}

/** Purchase price plus every upgrade already paid to reach this level. */
export function assetMoneySpent(price: number, level: number, catalogId?: string): number {
  let spent = price;
  for (let step = 1; step < level; step += 1) {
    spent += assetUpgradeCost(price, step, catalogId) ?? 0;
  }
  return spent;
}

function presentOwned(row: { id: string; catalogId: string; level: number }) {
  const item = assetById(row.catalogId);
  const price = item?.price ?? 0;
  const level = row.level;
  const workshop = row.catalogId === "workshop";
  const maxLevel = assetCap(row.catalogId, item);
  return {
    id: row.id,
    catalogId: row.catalogId,
    name: item?.name ?? row.catalogId,
    kind: item?.kind ?? "property",
    note: item?.note ?? "",
    price,
    level,
    maxLevel,
    nextUpgradeCost: workshop ? null : assetUpgradeCost(price, level, row.catalogId),
  };
}

export async function listProperties(userId: string) {
  const rows = await prisma.property.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const ownedIds = new Set(rows.map((row) => row.catalogId));
  const owned = rows.map(presentOwned);
  const catalog = ASSETS.filter((item) => item.price > 0).map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    kind: item.kind,
    note: item.note,
    minReputation: item.minReputation ?? null,
    maxLevel: item.maxLevel ?? ASSET_MAX_LEVEL,
    owned: ownedIds.has(item.id),
  }));
  return {
    properties: owned.filter((row) => row.kind === "property"),
    vehicles: owned.filter((row) => row.kind === "vehicle"),
    propertyCatalog: catalog.filter((item) => item.kind === "property"),
    vehicleCatalog: catalog.filter((item) => item.kind === "vehicle"),
  };
}

export async function buyProperty(userId: string, catalogId: string) {
  const item = assetById(catalogId);
  if (!item) throw new GameError(400, "UNKNOWN_PROPERTY", "That is not for sale.");
  if (item.id === "workshop" || item.price <= 0) {
    throw new GameError(400, "NOT_FOR_SALE", "The Workshop is autogranted, not sold.");
  }
  return prisma.$transaction(async (tx) => {
    if (item.minReputation) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { reputationLevel: true },
      });
      if (!user || user.reputationLevel < item.minReputation) {
        throw new GameError(
          403,
          "REPUTATION",
          `Reputation level ${item.minReputation} required to buy ${item.name}.`,
        );
      }
    }
    const already = await tx.property.findFirst({ where: { userId, catalogId } });
    if (already) throw new GameError(400, "ALREADY_OWNED", "You already hold that.");
    const paidFrom = await chargeMarket(tx, userId, item.price);
    const created = await tx.property.create({
      data: { userId, catalogId, level: 1 },
    });
    const baseType = item.kind === "vehicle" ? "vehicle_buy" : "property_buy";
    await tx.transaction.create({
      data: {
        type: paidFrom === "card" ? `${baseType}_card` : baseType,
        amount: item.price,
        fromUserId: userId,
      },
    });
    return presentOwned(created);
  });
}

export async function upgradeProperty(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.property.findFirst({ where: { id, userId } });
    if (!row) throw new GameError(404, "NOT_OWNED", "That asset is not on your ledger.");
    const item = assetById(row.catalogId);
    if (!item) throw new GameError(400, "UNKNOWN_PROPERTY", "That asset is not in the catalog.");
    if (row.catalogId === "workshop") {
      throw new GameError(400, "USE_WORKSHOP", "Upgrade the Workshop from the Assets → Workshop tab.");
    }
    const cap = assetCap(row.catalogId, item);
    if (row.level >= cap) {
      throw new GameError(400, "MAX_LEVEL", `That asset is already at level ${cap}.`);
    }
    const cost = assetUpgradeCost(item.price, row.level, row.catalogId);
    if (!cost) throw new GameError(400, "MAX_LEVEL", "No further upgrade is priced.");
    const paidFrom = await chargeMarket(tx, userId, cost);
    const updated = await tx.property.update({
      where: { id: row.id },
      data: { level: { increment: 1 } },
    });
    await tx.transaction.create({
      data: {
        type: paidFrom === "card" ? "asset_upgrade_card" : "asset_upgrade",
        amount: cost,
        fromUserId: userId,
      },
    });
    return presentOwned(updated);
  });
}
