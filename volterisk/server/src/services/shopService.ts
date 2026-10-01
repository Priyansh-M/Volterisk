import { GameError } from "../game/errors.js";
import { RULES, cameraUpgradeCost } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { debitCash } from "./economyService.js";

async function predictorQuantity(userId: string): Promise<number> {
  const row = await prisma.inventoryItem.findUnique({
    where: { userId_itemId: { userId, itemId: RULES.ESTIMATE_PREDICTOR_ID } },
  });
  return row?.quantity ?? 0;
}

export async function shopView(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
  const level = user.cameraLevel;
  return {
    predictor: {
      id: RULES.ESTIMATE_PREDICTOR_ID,
      name: "Estimate Predictor",
      price: RULES.ESTIMATE_PREDICTOR_COST,
      quantity: await predictorQuantity(userId),
    },
    camera: {
      id: RULES.CAMERA_ID,
      name: "Security Camera",
      level,
      nextCost: cameraUpgradeCost(level),
      installed: level > 0,
      maxLevel: RULES.CAMERA_MAX_LEVEL,
      description:
        "Each level subtracts that many points from an attacker's success chance by one percent for each level.",
    },
  };
}

export async function buyShopItem(userId: string, itemId: string) {
  if (itemId === RULES.ESTIMATE_PREDICTOR_ID) {
    return prisma.$transaction(async (tx) => {
      await debitCash(tx, userId, RULES.ESTIMATE_PREDICTOR_COST);
      const existing = await tx.inventoryItem.findUnique({
        where: { userId_itemId: { userId, itemId } },
      });
      const row = existing
        ? await tx.inventoryItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: 1 } },
          })
        : await tx.inventoryItem.create({ data: { userId, itemId, quantity: 1 } });
      await tx.transaction.create({
        data: { type: "shop_buy", amount: RULES.ESTIMATE_PREDICTOR_COST, fromUserId: userId },
      });
      const user = await tx.user.findUnique({ where: { id: userId } });
      return { itemId, quantity: row.quantity, cash: user?.cash ?? 0 };
    });
  }

  if (itemId === RULES.CAMERA_ID) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
      if (user.cameraLevel > 0) {
        throw new GameError(400, "ALREADY_OWNED", "The camera is already installed. Upgrade it instead.");
      }
      const cost = cameraUpgradeCost(0);
      if (!cost) throw new GameError(400, "MAX_LEVEL", "That camera cannot be raised further.");
      await debitCash(tx, userId, cost);
      await tx.user.update({ where: { id: userId }, data: { cameraLevel: 1 } });
      await tx.transaction.create({
        data: { type: "camera_buy", amount: cost, fromUserId: userId },
      });
      const fresh = await tx.user.findUnique({ where: { id: userId } });
      return { itemId, level: 1, cash: fresh?.cash ?? 0, nextCost: cameraUpgradeCost(1) };
    });
  }

  throw new GameError(400, "UNKNOWN_ITEM", "That item is not on the counter.");
}

export async function upgradeCamera(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
    if (user.cameraLevel < 1) {
      throw new GameError(400, "NOT_OWNED", "Buy the camera before upgrading it.");
    }
    const cost = cameraUpgradeCost(user.cameraLevel);
    if (!cost) throw new GameError(400, "MAX_LEVEL", "That camera is already at its cap.");
    await debitCash(tx, userId, cost);
    const updated = await tx.user.update({
      where: { id: userId },
      data: { cameraLevel: { increment: 1 } },
    });
    await tx.transaction.create({
      data: { type: "camera_upgrade", amount: cost, fromUserId: userId },
    });
    return {
      level: updated.cameraLevel,
      cash: updated.cash,
      nextCost: cameraUpgradeCost(updated.cameraLevel),
      spent: cost,
    };
  });
}
