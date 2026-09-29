import { GameError } from "../game/errors.js";
import { prisma } from "../prisma.js";
import { debitCash } from "./economyService.js";

export const PROPERTIES = [
  { id: "garage", name: "Garage", price: 15_000, note: "A bay that qualifies you for heavier contracts." },
  { id: "safehouse", name: "Safehouse", price: 25_000, note: "A second door and a quiet room." },
] as const;

export async function listProperties(userId: string) {
  const owned = await prisma.property.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const ownedIds = new Set(owned.map((row) => row.catalogId));
  return {
    owned: owned.map((row) => ({
      id: row.id,
      catalogId: row.catalogId,
      level: row.level,
      name: PROPERTIES.find((item) => item.id === row.catalogId)?.name ?? row.catalogId,
    })),
    catalog: PROPERTIES.map((item) => ({ ...item, owned: ownedIds.has(item.id) })),
  };
}

export async function buyProperty(userId: string, catalogId: string) {
  const item = PROPERTIES.find((entry) => entry.id === catalogId);
  if (!item) throw new GameError(400, "UNKNOWN_PROPERTY", "That property is not for sale.");
  return prisma.$transaction(async (tx) => {
    const already = await tx.property.findFirst({ where: { userId, catalogId } });
    if (already) throw new GameError(400, "ALREADY_OWNED", "You already hold that property.");
    await debitCash(tx, userId, item.price);
    const created = await tx.property.create({
      data: { userId, catalogId, level: 1 },
    });
    await tx.transaction.create({
      data: { type: "property_buy", amount: item.price, fromUserId: userId },
    });
    return { id: created.id, catalogId, name: item.name, level: 1 };
  });
}
