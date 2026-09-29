import { GameError } from "../game/errors.js";
import { prisma } from "../prisma.js";
import { debitCash } from "./economyService.js";

export const ASSET_MAX_LEVEL = 10;

export const ASSETS = [
  { id: "garage", name: "Garage", price: 20_000, kind: "property", note: "A bay that qualifies you for heavier contracts." },
  { id: "safehouse", name: "Safehouse", price: 30_000, kind: "property", note: "A second door and a quiet room." },
  { id: "hangar", name: "Hangar", price: 50_000, kind: "property", note: "Cover for anything that needs a runway." },
  { id: "caravan", name: "Caravan", price: 50_000, kind: "property", note: "A house that can leave town." },
  { id: "car", name: "Car", price: 35_000, kind: "vehicle", note: "A street car with clean plates." },
  { id: "bike", name: "Bike", price: 20_000, kind: "vehicle", note: "Fast through the alleys." },
  { id: "truck", name: "Truck", price: 75_000, kind: "vehicle", note: "Hauls a job that will not fit in a trunk." },
  { id: "airplane", name: "Airplane", price: 90_000, kind: "vehicle", note: "Leaves the city before the sirens do." },
] as const;

export type AssetKind = (typeof ASSETS)[number]["kind"];

export function assetById(id: string) {
  return ASSETS.find((item) => item.id === id) ?? null;
}

/**
 * Level 1 → 2 costs the purchase price / 5.
 * Each later step costs (purchase price + the previous upgrade cost) / 5.
 */
export function assetUpgradeCost(price: number, currentLevel: number): number | null {
  if (currentLevel < 1 || currentLevel >= ASSET_MAX_LEVEL) return null;
  let previous = 0;
  let cost = 0;
  for (let step = 1; step <= currentLevel; step += 1) {
    cost = step === 1 ? price / 5 : (price + previous) / 5;
    previous = cost;
  }
  return Math.round(cost);
}

function presentOwned(row: { id: string; catalogId: string; level: number }) {
  const item = assetById(row.catalogId);
  const price = item?.price ?? 0;
  const level = row.level;
  return {
    id: row.id,
    catalogId: row.catalogId,
    name: item?.name ?? row.catalogId,
    kind: item?.kind ?? "property",
    note: item?.note ?? "",
    price,
    level,
    maxLevel: ASSET_MAX_LEVEL,
    nextUpgradeCost: assetUpgradeCost(price, level),
  };
}

export async function listProperties(userId: string) {
  const rows = await prisma.property.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const ownedIds = new Set(rows.map((row) => row.catalogId));
  const owned = rows.map(presentOwned);
  const catalog = ASSETS.map((item) => ({ ...item, owned: ownedIds.has(item.id) }));
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
  return prisma.$transaction(async (tx) => {
    const already = await tx.property.findFirst({ where: { userId, catalogId } });
    if (already) throw new GameError(400, "ALREADY_OWNED", "You already hold that.");
    await debitCash(tx, userId, item.price);
    const created = await tx.property.create({
      data: { userId, catalogId, level: 1 },
    });
    await tx.transaction.create({
      data: { type: item.kind === "vehicle" ? "vehicle_buy" : "property_buy", amount: item.price, fromUserId: userId },
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
    if (row.level >= ASSET_MAX_LEVEL) {
      throw new GameError(400, "MAX_LEVEL", "That asset is already at level 10.");
    }
    const cost = assetUpgradeCost(item.price, row.level);
    if (!cost) throw new GameError(400, "MAX_LEVEL", "No further upgrade is priced.");
    await debitCash(tx, userId, cost);
    const updated = await tx.property.update({
      where: { id: row.id },
      data: { level: { increment: 1 } },
    });
    await tx.transaction.create({
      data: { type: "asset_upgrade", amount: cost, fromUserId: userId },
    });
    return presentOwned(updated);
  });
}
