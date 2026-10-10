import { BLACK_MARKET, MATERIALS, materialById } from "../game/workshopEconomy.js";
import { vaultModById, weaponModById } from "../game/careersAndMods.js";
import { GameError } from "../game/errors.js";
import { weaponById } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { chargeSpend, creditEarn } from "./economyService.js";
import { creditItem, debitItem } from "./inventoryService.js";

async function expireOpen() {
  const now = new Date();
  const stale = await prisma.marketListing.findMany({
    where: { status: "open", expiresAt: { lte: now } },
    take: 40,
  });
  if (stale.length === 0) return;
  // One interactive transaction — connection_limit=1 cannot run N parallel txs.
  await prisma.$transaction(async (tx) => {
    for (const row of stale) {
      const closed = await tx.marketListing.updateMany({
        where: { id: row.id, status: "open" },
        data: { status: "expired" },
      });
      if (closed.count !== 1) continue;
      if (row.kind === "material") {
        await creditItem(tx, row.sellerId, row.itemId, row.quantity);
      } else if (row.kind === "weapon" && row.userWeaponId) {
        await tx.userWeapon.updateMany({
          where: { id: row.userWeaponId, userId: row.sellerId },
          data: { listed: false },
        });
      } else if (row.kind === "mod" && row.modOwnedId) {
        await tx.modOwned.updateMany({
          where: { id: row.modOwnedId, userId: row.sellerId },
          data: { status: "inventory" },
        });
      }
    }
  });
}

function sellerProceeds(price: number) {
  return Math.floor(price * (1 - BLACK_MARKET.FEE_RATE));
}

function feeAmount(price: number) {
  return price - sellerProceeds(price);
}

export async function listBlackMarket(userId: string) {
  await expireOpen();
  const open = await prisma.marketListing.findMany({
    where: { status: "open", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { seller: { select: { username: true } } },
  });
  const mine = await prisma.marketListing.findMany({
    where: { sellerId: userId, status: "open" },
    orderBy: { createdAt: "desc" },
  });
  const listings = await Promise.all(open.map((row) => presentListing(row)));
  const mineRows = await Promise.all(mine.map((row) => presentListing(row)));
  return {
    feeRate: BLACK_MARKET.FEE_RATE,
    listingDays: 7,
    listings,
    mine: mineRows,
  };
}

async function presentListing(row: {
  id: string;
  sellerId: string;
  kind: string;
  itemId: string;
  quantity: number;
  price: number;
  status: string;
  userWeaponId: string | null;
  modOwnedId: string | null;
  expiresAt: Date;
  createdAt: Date;
  seller?: { username: string };
}) {
  let name = row.itemId;
  let note = "";
  let rarity: string | null = null;
  let weaponLevel: number | null = null;
  let durability: number | null = null;
  let maxDurability: number | null = null;

  if (row.kind === "material") {
    const m = materialById(row.itemId);
    name = m?.name ?? row.itemId;
    rarity = m?.rarity ?? null;
    note = m ? `${m.rarity} material · ${m.sources.join(" · ")}` : "Crafting material.";
  } else if (row.kind === "mod") {
    const m = weaponModById(row.itemId) ?? vaultModById(row.itemId);
    name = m?.name ?? row.itemId;
    note = m?.description ?? "Weapon or vault modification.";
    rarity = m?.tier ?? null;
  } else if (row.kind === "weapon") {
    const w = weaponById(row.itemId);
    name = w?.name ?? row.itemId;
    note = w?.description ?? "Breaching tool.";
    if (row.userWeaponId) {
      const owned = await prisma.userWeapon.findUnique({
        where: { id: row.userWeaponId },
        select: { upgradeLevel: true, durability: true, maxDurability: true },
      });
      if (owned) {
        weaponLevel = owned.upgradeLevel;
        durability = owned.durability;
        maxDurability = owned.maxDurability;
        note = `${w?.description ?? "Breaching tool."} Level ${owned.upgradeLevel} · durability ${owned.durability}/${owned.maxDurability}.`;
      }
    }
  }

  return {
    id: row.id,
    kind: row.kind,
    itemId: row.itemId,
    name,
    note,
    rarity,
    weaponLevel,
    durability,
    maxDurability,
    quantity: row.quantity,
    price: row.price,
    sellerProceeds: sellerProceeds(row.price),
    fee: feeAmount(row.price),
    seller: row.seller?.username ?? row.sellerId,
    sellerId: row.sellerId,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    userWeaponId: row.userWeaponId,
    modOwnedId: row.modOwnedId,
  };
}

export async function createListing(
  userId: string,
  input: {
    kind: "material" | "weapon" | "mod";
    itemId?: string;
    quantity?: number;
    price: number;
    userWeaponId?: string;
    modOwnedId?: string;
  },
) {
  if (!Number.isFinite(input.price) || input.price < 1) {
    throw new GameError(400, "BAD_PRICE", "Price must be at least $1.");
  }
  await expireOpen();
  return prisma.$transaction(async (tx) => {
    const expiresAt = new Date(Date.now() + BLACK_MARKET.LISTING_MS);
    if (input.kind === "material") {
      const itemId = String(input.itemId ?? "");
      const qty = Math.floor(input.quantity ?? 0);
      if (!materialById(itemId) || qty < 1) throw new GameError(400, "BAD_ITEM", "Invalid material listing.");
      const ok = await debitItem(tx, userId, itemId, qty);
      if (!ok) throw new GameError(400, "MATERIALS", "Not enough of that material.");
      const row = await tx.marketListing.create({
        data: {
          sellerId: userId,
          kind: "material",
          itemId,
          quantity: qty,
          price: Math.floor(input.price),
          expiresAt,
        },
      });
      return await presentListing(row);
    }
    if (input.kind === "weapon") {
      const weapon = await tx.userWeapon.findFirst({
        where: { id: String(input.userWeaponId ?? ""), userId },
        include: { weapon: true },
      });
      if (!weapon || weapon.durability <= 0) throw new GameError(400, "WEAPON_NOT_OWNED", "Weapon not available.");
      if (weapon.listed) throw new GameError(400, "ALREADY_LISTED", "Already listed.");
      const ratio = weapon.durability / Math.max(1, weapon.maxDurability);
      if (ratio + 1e-9 < BLACK_MARKET.WEAPON_MIN_DURABILITY_RATIO) {
        throw new GameError(400, "DURABILITY", "Need at least 20% durability to list.");
      }
      await tx.userWeapon.update({ where: { id: weapon.id }, data: { listed: true, equipped: false } });
      const row = await tx.marketListing.create({
        data: {
          sellerId: userId,
          kind: "weapon",
          itemId: weapon.weaponId,
          quantity: 1,
          price: Math.floor(input.price),
          userWeaponId: weapon.id,
          expiresAt,
        },
      });
      return await presentListing({ ...row, seller: undefined });
    }
    if (input.kind === "mod") {
      const mod = await tx.modOwned.findFirst({
        where: { id: String(input.modOwnedId ?? ""), userId, status: "inventory" },
      });
      if (!mod) throw new GameError(400, "MOD_UNAVAILABLE", "Modification must be in inventory (not installed).");
      await tx.modOwned.update({ where: { id: mod.id }, data: { status: "listed" } });
      const row = await tx.marketListing.create({
        data: {
          sellerId: userId,
          kind: "mod",
          itemId: mod.modId,
          quantity: 1,
          price: Math.floor(input.price),
          modOwnedId: mod.id,
          expiresAt,
        },
      });
      return await presentListing(row);
    }
    throw new GameError(400, "BAD_KIND", "Unsupported listing kind.");
  });
}

export async function cancelListing(userId: string, listingId: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.marketListing.findFirst({ where: { id: listingId, sellerId: userId, status: "open" } });
    if (!row) throw new GameError(404, "NOT_FOUND", "Listing not found.");
    const closed = await tx.marketListing.updateMany({
      where: { id: row.id, status: "open" },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    if (closed.count !== 1) throw new GameError(409, "CLOSED", "Listing already closed.");
    if (row.kind === "material") await creditItem(tx, userId, row.itemId, row.quantity);
    if (row.kind === "weapon" && row.userWeaponId) {
      await tx.userWeapon.update({ where: { id: row.userWeaponId }, data: { listed: false } });
    }
    if (row.kind === "mod" && row.modOwnedId) {
      await tx.modOwned.update({ where: { id: row.modOwnedId }, data: { status: "inventory" } });
    }
    return { ok: true };
  });
}

export async function buyListing(userId: string, listingId: string) {
  await expireOpen();
  return prisma.$transaction(async (tx) => {
    const row = await tx.marketListing.findFirst({ where: { id: listingId, status: "open" } });
    if (!row) throw new GameError(404, "NOT_FOUND", "Listing not available.");
    if (row.sellerId === userId) throw new GameError(400, "SELF_BUY", "You cannot buy your own listing.");
    if (row.expiresAt.getTime() <= Date.now()) throw new GameError(400, "EXPIRED", "Listing expired.");

    await chargeSpend(tx, userId, row.price);
    const proceeds = sellerProceeds(row.price);
    await creditEarn(tx, row.sellerId, proceeds);
    const sold = await tx.marketListing.updateMany({
      where: { id: row.id, status: "open" },
      data: { status: "sold", buyerId: userId, soldAt: new Date() },
    });
    if (sold.count !== 1) throw new GameError(409, "CLOSED", "Listing closed.");

    if (row.kind === "material") {
      await creditItem(tx, userId, row.itemId, row.quantity);
    } else if (row.kind === "weapon" && row.userWeaponId) {
      await tx.userWeapon.update({
        where: { id: row.userWeaponId },
        data: { userId, listed: false, equipped: false },
      });
    } else if (row.kind === "mod" && row.modOwnedId) {
      await tx.modOwned.update({
        where: { id: row.modOwnedId },
        data: { userId, status: "inventory", userWeaponId: null, vaultSlot: null },
      });
    }

    await tx.transaction.create({
      data: { type: "black_market_buy", amount: row.price, fromUserId: userId, toUserId: row.sellerId },
    });
    await tx.transaction.create({
      data: { type: "black_market_fee", amount: feeAmount(row.price), fromUserId: row.sellerId },
    });
    const buyer = await tx.user.findUnique({ where: { id: userId }, select: { cash: true } });
    return { ok: true, cash: buyer?.cash ?? 0, paid: row.price, fee: feeAmount(row.price) };
  });
}

export function materialCatalog() {
  return MATERIALS.map((m) => ({ id: m.id, name: m.name, rarity: m.rarity, refPrice: m.refPrice }));
}
