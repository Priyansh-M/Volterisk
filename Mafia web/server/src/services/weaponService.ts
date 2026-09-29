import { GameError } from "../game/errors.js";
import { RULES, effectiveWeaponLevel, weaponById } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { debitCash } from "./economyService.js";

// Future: a marketplace would resell owned weapons. Not in this pass.

function presentOwned(
  row: {
    weaponId: string;
    upgradeLevel: number;
    equipped: boolean;
    weapon: { name: string; number: number };
  },
) {
  const nextUpgradeCost =
    row.upgradeLevel >= RULES.WEAPON_MAX_UPGRADE
      ? null
      : (RULES.WEAPON_UPGRADE_COSTS[row.weaponId]?.[row.upgradeLevel] ?? null);
  return {
    id: row.weaponId,
    name: row.weapon.name,
    number: row.weapon.number,
    upgradeLevel: row.upgradeLevel,
    effectiveLevel: effectiveWeaponLevel(row.weapon.number, row.upgradeLevel),
    nextEffectiveLevel:
      row.upgradeLevel >= RULES.WEAPON_MAX_UPGRADE
        ? null
        : effectiveWeaponLevel(row.weapon.number, row.upgradeLevel + 1),
    equipped: row.equipped,
    nextUpgradeCost,
  };
}

export async function listWeapons(userId: string) {
  const ownedRows = await prisma.userWeapon.findMany({
    where: { userId },
    include: { weapon: true },
    orderBy: { weapon: { number: "asc" } },
  });
  const owned = ownedRows.map(presentOwned);
  const best = owned.reduce((max, weapon) => Math.max(max, weapon.number), 0);
  const next = RULES.WEAPONS.find((weapon) => weapon.number === best + 1) ?? null;
  const shop = next
    ? {
        id: next.id,
        name: next.name,
        number: next.number,
        price: RULES.WEAPON_BUY_COSTS[next.id] ?? null,
        effectiveLevel: effectiveWeaponLevel(next.number, RULES.WEAPON_MIN_UPGRADE),
      }
    : null;
  return { owned, shop };
}

export async function buyWeapon(userId: string, weaponId: string) {
  const weapon = weaponById(weaponId);
  if (!weapon) throw new GameError(400, "UNKNOWN_WEAPON", "That weapon is not in the catalog.");
  const price = RULES.WEAPON_BUY_COSTS[weaponId];
  if (price === undefined || price <= 0) {
    throw new GameError(400, "NOT_FOR_SALE", "That weapon is not for sale.");
  }

  return prisma.$transaction(async (tx) => {
    const already = await tx.userWeapon.findUnique({
      where: { userId_weaponId: { userId, weaponId } },
    });
    if (already) throw new GameError(400, "ALREADY_OWNED", "You already own that weapon.");

    const owned = await tx.userWeapon.findMany({
      where: { userId },
      include: { weapon: true },
    });
    const best = owned.reduce((max, row) => Math.max(max, row.weapon.number), 0);
    if (weapon.number !== best + 1) {
      throw new GameError(400, "NOT_NEXT_WEAPON", "You can only buy the next weapon in the line.");
    }

    await debitCash(tx, userId, price);
    const created = await tx.userWeapon.create({
      data: {
        userId,
        weaponId,
        upgradeLevel: RULES.WEAPON_MIN_UPGRADE,
        equipped: false,
      },
      include: { weapon: true },
    });
    await tx.transaction.create({
      data: { type: "weapon_buy", amount: price, fromUserId: userId },
    });
    return presentOwned(created);
  });
}

export async function upgradeWeapon(userId: string, weaponId: string) {
  if (!weaponById(weaponId)) {
    throw new GameError(400, "UNKNOWN_WEAPON", "That weapon is not in the catalog.");
  }
  return prisma.$transaction(async (tx) => {
    const owned = await tx.userWeapon.findUnique({
      where: { userId_weaponId: { userId, weaponId } },
      include: { weapon: true },
    });
    if (!owned) throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not in your arsenal.");
    if (owned.upgradeLevel >= RULES.WEAPON_MAX_UPGRADE) {
      throw new GameError(400, "MAX_UPGRADE", "That weapon is already at its cap.");
    }
    const cost = RULES.WEAPON_UPGRADE_COSTS[weaponId]?.[owned.upgradeLevel];
    if (!cost) throw new GameError(400, "MAX_UPGRADE", "No further upgrade is priced.");
    await debitCash(tx, userId, cost);
    const updated = await tx.userWeapon.update({
      where: { id: owned.id },
      data: { upgradeLevel: { increment: 1 } },
      include: { weapon: true },
    });
    await tx.transaction.create({
      data: { type: "weapon_upgrade", amount: cost, fromUserId: userId },
    });
    return presentOwned(updated);
  });
}

export async function equipWeapon(userId: string, weaponId: string) {
  const owned = await prisma.userWeapon.findUnique({
    where: { userId_weaponId: { userId, weaponId } },
  });
  if (!owned) throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not in your arsenal.");
  await prisma.$transaction([
    prisma.userWeapon.updateMany({ where: { userId }, data: { equipped: false } }),
    prisma.userWeapon.update({
      where: { userId_weaponId: { userId, weaponId } },
      data: { equipped: true },
    }),
  ]);
  const rows = await listWeapons(userId);
  return rows;
}
