import { weaponMaxDurabilityBonus, weaponModById } from "../game/careersAndMods.js";
import { GameError } from "../game/errors.js";
import { RULES, attackPower, maxDurability, weaponById, weaponModSlotsForLevel } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { repairCostForWeapon } from "./combatMods.js";
import { chargeSpend, type Tx } from "./economyService.js";
import { weaponModIds } from "./modService.js";

async function presentOwned(
  row: {
    id: string;
    weaponId: string;
    upgradeLevel: number;
    durability: number;
    maxDurability: number;
    equipped: boolean;
    listed?: boolean;
    weapon: { name: string; number: number };
  },
  modSlots = 0,
) {
  const catalog = weaponById(row.weaponId);
  const attack = attackPower(row.weapon.number, row.upgradeLevel);
  const nextAttack =
    row.upgradeLevel >= RULES.WEAPON_MAX_UPGRADE
      ? null
      : attackPower(row.weapon.number, row.upgradeLevel + 1);
  const nextUpgradeCost =
    row.upgradeLevel >= RULES.WEAPON_MAX_UPGRADE
      ? null
      : (RULES.WEAPON_UPGRADE_COSTS[row.weaponId]?.[row.upgradeLevel] ?? null);
  const modIds = await weaponModIds(row.id);
  const repairCost = repairCostForWeapon(row.weaponId, row.durability, row.maxDurability, modIds);
  const installedMods = modIds.map((id) => {
    const def = weaponModById(id);
    return {
      id,
      name: def?.name ?? id,
      tier: def?.tier ?? "basic",
      description: def?.description ?? "",
      breaksOnRemove: Boolean(def?.breaksOnRemove),
      maxDurabilityBonus: def?.maxDurabilityBonus ?? 0,
    };
  });
  return {
    instanceId: row.id,
    id: row.weaponId,
    name: row.weapon.name,
    number: row.weapon.number,
    type: catalog?.type ?? "Tool",
    tier: catalog?.tier ?? row.weapon.number,
    description: catalog?.description ?? "",
    upgradeLevel: row.upgradeLevel,
    attack,
    nextAttack,
    effectiveLevel: attack,
    nextEffectiveLevel: nextAttack,
    durability: row.durability,
    maxDurability: row.maxDurability,
    equipped: row.equipped,
    listed: Boolean(row.listed),
    mods: modIds,
    installedMods,
    modSlots,
    modSlotsUsed: installedMods.length,
    repairCost,
    nextUpgradeCost,
  };
}

async function findInstance(client: Tx | typeof prisma, userId: string, weaponId?: string, instanceId?: string) {
  if (instanceId) {
    return client.userWeapon.findFirst({
      where: { id: instanceId, userId },
      include: { weapon: true },
    });
  }
  if (!weaponId) return null;
  return client.userWeapon.findFirst({
    where: { userId, weaponId, durability: { gt: 0 } },
    include: { weapon: true },
    orderBy: [{ equipped: "desc" }, { upgradeLevel: "desc" }],
  });
}

export async function listWeapons(userId: string) {
  const [ownedRows, unlockRows, user] = await Promise.all([
    prisma.userWeapon.findMany({
      where: { userId, durability: { gt: 0 } },
      include: { weapon: true },
      orderBy: [{ weapon: { number: "asc" } }, { upgradeLevel: "desc" }],
    }),
    prisma.userWeapon.findMany({
      where: { userId },
      select: { weapon: { select: { number: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { reputationLevel: true } }),
  ]);
  const modSlots = weaponModSlotsForLevel(user?.reputationLevel ?? 1);
  const owned = await Promise.all(ownedRows.map((row) => presentOwned(row, modSlots)));
  const unlockedThrough = unlockRows.reduce((max, row) => Math.max(max, row.weapon.number), 0);
  const next = RULES.WEAPONS.find((weapon) => weapon.number === unlockedThrough + 1) ?? null;
  const shop = next
    ? {
        id: next.id,
        name: next.name,
        number: next.number,
        type: next.type,
        price: RULES.WEAPON_BUY_COSTS[next.id] ?? null,
        attack: attackPower(next.number, RULES.WEAPON_MIN_UPGRADE),
        effectiveLevel: attackPower(next.number, RULES.WEAPON_MIN_UPGRADE),
      }
    : null;
  return {
    owned,
    shop,
    unlockedThrough,
    weaponModSlots: modSlots,
  };
}

export async function buyWeapon(userId: string, weaponId: string) {
  const weapon = weaponById(weaponId);
  if (!weapon) throw new GameError(400, "UNKNOWN_WEAPON", "That weapon is not in the catalog.");
  const price = RULES.WEAPON_BUY_COSTS[weaponId];
  if (price === undefined || price <= 0) {
    throw new GameError(400, "NOT_FOR_SALE", "That weapon is not for sale.");
  }

  return prisma.$transaction(async (tx) => {
    const owned = await tx.userWeapon.findMany({
      where: { userId },
      include: { weapon: true },
    });
    const best = owned.reduce((max, row) => Math.max(max, row.weapon.number), 0);
    const starter = weaponId === RULES.WEAPONS[0].id;
    if (!starter && weapon.number > best + 1) {
      throw new GameError(400, "NOT_NEXT_WEAPON", "You can only buy the next weapon in the line.");
    }

    await chargeSpend(tx, userId, price);
    const uses = maxDurability(weaponId, RULES.WEAPON_MIN_UPGRADE);
    const created = await tx.userWeapon.create({
      data: {
        userId,
        weaponId,
        upgradeLevel: RULES.WEAPON_MIN_UPGRADE,
        durability: uses,
        maxDurability: uses,
        equipped: false,
      },
      include: { weapon: true },
    });
    await tx.transaction.create({
      data: { type: "weapon_buy", amount: price, fromUserId: userId },
    });
    return await presentOwned(created);
  });
}

export async function upgradeWeapon(userId: string, weaponId?: string, instanceId?: string) {
  return prisma.$transaction(async (tx) => {
    const owned = await findInstance(tx, userId, weaponId, instanceId);
    if (!owned) throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not in your arsenal.");
    if (owned.upgradeLevel >= RULES.WEAPON_MAX_UPGRADE) {
      throw new GameError(400, "MAX_UPGRADE", "That weapon is already at its cap.");
    }
    const cost = RULES.WEAPON_UPGRADE_COSTS[owned.weaponId]?.[owned.upgradeLevel];
    if (!cost) throw new GameError(400, "MAX_UPGRADE", "No further upgrade is priced.");
    await chargeSpend(tx, userId, cost);
    if (owned.listed) throw new GameError(400, "WEAPON_LISTED", "Listed weapons cannot be upgraded.");
    const nextLevel = owned.upgradeLevel + 1;
    const modIds = await weaponModIds(owned.id);
    const cap = maxDurability(owned.weaponId, nextLevel) + weaponMaxDurabilityBonus(modIds);
    const updated = await tx.userWeapon.update({
      where: { id: owned.id },
      data: {
        upgradeLevel: nextLevel,
        maxDurability: cap,
        // Upgrades must not restore durability.
        durability: Math.min(owned.durability, cap),
      },
      include: { weapon: true },
    });
    await tx.transaction.create({
      data: { type: "weapon_upgrade", amount: cost, fromUserId: userId },
    });
    return presentOwned(updated);
  });
}

export async function repairWeapon(userId: string, instanceId: string) {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.userWeapon.findFirst({
      where: { id: instanceId, userId },
      include: { weapon: true },
    });
    if (!owned) throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not in your arsenal.");
    if (owned.durability <= 0) {
      throw new GameError(400, "DESTROYED", "A broken weapon cannot be repaired.");
    }
    if (owned.listed) throw new GameError(400, "WEAPON_LISTED", "Listed weapons cannot be repaired.");
    if (owned.durability >= owned.maxDurability) {
      throw new GameError(400, "FULL_DURABILITY", "That weapon does not need repair.");
    }
    const mods = await tx.modOwned.findMany({
      where: { userWeaponId: owned.id, status: "installed" },
      select: { modId: true },
    });
    const cost = repairCostForWeapon(
      owned.weaponId,
      owned.durability,
      owned.maxDurability,
      mods.map((m) => m.modId),
    );
    if (cost <= 0) throw new GameError(400, "FULL_DURABILITY", "That weapon does not need repair.");
    await chargeSpend(tx, userId, cost);
    const updated = await tx.userWeapon.update({
      where: { id: owned.id },
      data: { durability: owned.maxDurability },
      include: { weapon: true },
    });
    await tx.transaction.create({
      data: { type: "weapon_repair", amount: cost, fromUserId: userId },
    });
    return { ...(await presentOwned(updated)), spent: cost };
  });
}

export async function equipWeapon(userId: string, weaponId?: string, instanceId?: string) {
  const owned = await findInstance(prisma, userId, weaponId, instanceId);
  if (!owned || owned.durability <= 0) {
    throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not in your arsenal.");
  }
  await prisma.$transaction([
    prisma.userWeapon.updateMany({ where: { userId }, data: { equipped: false } }),
    prisma.userWeapon.update({ where: { id: owned.id }, data: { equipped: true } }),
  ]);
  return listWeapons(userId);
}
