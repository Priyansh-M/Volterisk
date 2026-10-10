import { prisma } from "../prisma.js";
import type { Tx } from "./economyService.js";

export async function getQty(userId: string, itemId: string, client: Tx | typeof prisma = prisma) {
  const row = await client.inventoryItem.findUnique({
    where: { userId_itemId: { userId, itemId } },
    select: { quantity: true },
  });
  return row?.quantity ?? 0;
}

export async function listInventory(userId: string) {
  return prisma.inventoryItem.findMany({ where: { userId }, orderBy: { itemId: "asc" } });
}

export async function creditItem(tx: Tx, userId: string, itemId: string, quantity: number) {
  if (quantity <= 0) return;
  const existing = await tx.inventoryItem.findUnique({ where: { userId_itemId: { userId, itemId } } });
  if (existing) {
    await tx.inventoryItem.update({
      where: { id: existing.id },
      data: { quantity: { increment: quantity } },
    });
  } else {
    await tx.inventoryItem.create({ data: { userId, itemId, quantity } });
  }
}

export async function debitItem(tx: Tx, userId: string, itemId: string, quantity: number): Promise<boolean> {
  if (quantity <= 0) return true;
  const row = await tx.inventoryItem.findUnique({ where: { userId_itemId: { userId, itemId } } });
  if (!row || row.quantity < quantity) return false;
  if (row.quantity === quantity) {
    await tx.inventoryItem.delete({ where: { id: row.id } });
  } else {
    await tx.inventoryItem.update({
      where: { id: row.id },
      data: { quantity: { decrement: quantity } },
    });
  }
  return true;
}

export async function ownedMap(userId: string, client: Tx | typeof prisma = prisma) {
  const rows = await client.inventoryItem.findMany({ where: { userId } });
  const map: Record<string, number> = {};
  for (const row of rows) map[row.itemId] = row.quantity;
  return map;
}
