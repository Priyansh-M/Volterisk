import {
  VAULT_MODS,
  WEAPON_MOD_INSTALL_FEE,
  WEAPON_MODS,
  territoryModById,
  vaultModById,
  weaponModById,
} from "../game/careersAndMods.js";
import { GameError } from "../game/errors.js";
import { vaultModSlotsForLevel, weaponModSlotsForLevel } from "../game/rules.js";
import { CRAFT_RECIPES } from "../game/workshopEconomy.js";
import { prisma } from "../prisma.js";
import { chargeSpend } from "./economyService.js";

const CRAFTABLE_MOD_IDS = new Set(CRAFT_RECIPES.map((r) => r.modId));

function isShopSoldMod(mod: { id: string; shopPrice: number | null }): boolean {
  return mod.shopPrice != null && !CRAFTABLE_MOD_IDS.has(mod.id);
}

function modDefFor(kind: string, modId: string) {
  if (kind === "weapon") return weaponModById(modId);
  if (kind === "vault") return vaultModById(modId);
  if (kind === "territory") return territoryModById(modId);
  return null;
}

function presentMod(row: {
  id: string;
  modId: string;
  kind: string;
  status: string;
  userWeaponId: string | null;
  vaultSlot: number | null;
  activatedAt: Date | null;
}) {
  const def = modDefFor(row.kind, row.modId);
  const weaponDef = row.kind === "weapon" ? weaponModById(row.modId) : null;
  return {
    instanceId: row.id,
    modId: row.modId,
    kind: row.kind,
    status: row.status,
    name: def?.name ?? row.modId,
    tier: def?.tier ?? "basic",
    description: def?.description ?? "",
    userWeaponId: row.userWeaponId,
    vaultSlot: row.vaultSlot,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    shopPrice: def && "shopPrice" in def ? def.shopPrice : null,
    breaksOnRemove: Boolean(weaponDef?.breaksOnRemove),
    maxDurabilityBonus: weaponDef?.maxDurabilityBonus ?? 0,
  };
}

export async function listMods(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reputationLevel: true },
  });
  const rows = await prisma.modOwned.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return {
    owned: rows.map(presentMod),
    weaponSlots: weaponModSlotsForLevel(user?.reputationLevel ?? 1),
    vaultSlots: vaultModSlotsForLevel(user?.reputationLevel ?? 1),
    shopWeapon: WEAPON_MODS.filter(isShopSoldMod).map((m) => ({
      id: m.id,
      name: m.name,
      tier: m.tier,
      description: m.description,
      price: m.shopPrice,
      kind: "weapon" as const,
    })),
    shopVault: VAULT_MODS.filter(isShopSoldMod).map((m) => ({
      id: m.id,
      name: m.name,
      tier: m.tier,
      description: m.description,
      price: m.shopPrice,
      kind: "vault" as const,
    })),
    installFees: WEAPON_MOD_INSTALL_FEE,
  };
}

export async function buyMod(userId: string, modId: string) {
  const weapon = weaponModById(modId);
  const vault = vaultModById(modId);
  const def = weapon ?? vault;
  if (!def || !isShopSoldMod(def)) {
    throw new GameError(400, "NOT_FOR_SALE", "That modification is not sold in the shop. Craft it in the Workshop.");
  }
  return prisma.$transaction(async (tx) => {
    await chargeSpend(tx, userId, def.shopPrice!);
    const created = await tx.modOwned.create({
      data: {
        userId,
        modId: def.id,
        kind: def.kind,
        status: "inventory",
      },
    });
    await tx.transaction.create({
      data: { type: "mod_buy", amount: def.shopPrice!, fromUserId: userId },
    });
    return presentMod(created);
  });
}

export async function installWeaponMod(userId: string, instanceId: string, userWeaponId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { reputationLevel: true, cash: true },
    });
    if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
    const slots = weaponModSlotsForLevel(user.reputationLevel);
    if (slots <= 0) throw new GameError(403, "NO_SLOTS", "Weapon modification slots unlock at level 15.");

    const mod = await tx.modOwned.findFirst({ where: { id: instanceId, userId, kind: "weapon" } });
    if (!mod || mod.status !== "inventory") {
      throw new GameError(400, "MOD_UNAVAILABLE", "That modification is not in your inventory.");
    }
    const def = weaponModById(mod.modId);
    if (!def) throw new GameError(400, "UNKNOWN_MOD", "Unknown modification.");

    const weapon = await tx.userWeapon.findFirst({ where: { id: userWeaponId, userId } });
    if (!weapon || weapon.durability <= 0) {
      throw new GameError(400, "WEAPON_NOT_OWNED", "That weapon is not available.");
    }
    if (weapon.listed) throw new GameError(400, "WEAPON_LISTED", "Listed weapons cannot be modified.");

    const installed = await tx.modOwned.count({
      where: { userWeaponId, userId, status: "installed", kind: "weapon" },
    });
    if (installed >= slots) {
      throw new GameError(
        400,
        "SLOTS_FULL",
        `This weapon already has ${installed}/${slots} modification slot${slots === 1 ? "" : "s"} filled.`,
      );
    }

    const fee = WEAPON_MOD_INSTALL_FEE[def.tier];
    if (user.cash < fee) {
      throw new GameError(400, "INSUFFICIENT_FUNDS", `Need ${fee.toLocaleString("en-US")} cash to install.`);
    }
    await chargeSpend(tx, userId, fee);
    await tx.transaction.create({
      data: { type: "mod_install_weapon", amount: fee, fromUserId: userId },
    });
    const bonus = def.maxDurabilityBonus ?? 0;
    if (bonus > 0) {
      await tx.userWeapon.update({
        where: { id: weapon.id },
        data: {
          maxDurability: { increment: bonus },
          durability: { increment: bonus },
        },
      });
    }
    const updated = await tx.modOwned.update({
      where: { id: mod.id },
      data: { status: "installed", userWeaponId },
    });
    return presentMod(updated);
  });
}

export async function removeWeaponMod(userId: string, instanceId: string) {
  return prisma.$transaction(async (tx) => {
    const mod = await tx.modOwned.findFirst({
      where: { id: instanceId, userId, kind: "weapon", status: "installed" },
    });
    if (!mod) throw new GameError(400, "MOD_NOT_INSTALLED", "That modification is not installed.");
    const weapon = mod.userWeaponId
      ? await tx.userWeapon.findFirst({ where: { id: mod.userWeaponId, userId } })
      : null;
    if (weapon?.listed) throw new GameError(400, "WEAPON_LISTED", "Listed weapons cannot be modified.");
    const def = weaponModById(mod.modId);
    const bonus = def?.maxDurabilityBonus ?? 0;
    if (weapon && bonus > 0) {
      const nextMax = Math.max(1, weapon.maxDurability - bonus);
      await tx.userWeapon.update({
        where: { id: weapon.id },
        data: {
          maxDurability: nextMax,
          durability: Math.min(weapon.durability, nextMax),
        },
      });
    }
    if (def?.breaksOnRemove) {
      await tx.modOwned.delete({ where: { id: mod.id } });
      return {
        instanceId: mod.id,
        modId: mod.modId,
        kind: mod.kind,
        status: "destroyed",
        name: def.name,
        tier: def.tier,
        description: def.description,
        userWeaponId: null,
        vaultSlot: null,
        activatedAt: null,
        shopPrice: null,
        breaksOnRemove: true,
        maxDurabilityBonus: bonus,
        destroyed: true as const,
      };
    }
    const updated = await tx.modOwned.update({
      where: { id: mod.id },
      data: { status: "inventory", userWeaponId: null },
    });
    return presentMod(updated);
  });
}

export async function installVaultMod(userId: string, instanceId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { reputationLevel: true },
    });
    if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
    const slots = vaultModSlotsForLevel(user.reputationLevel);
    if (slots <= 0) throw new GameError(403, "NO_SLOTS", "Vault modification slots unlock at level 15.");

    const mod = await tx.modOwned.findFirst({ where: { id: instanceId, userId, kind: "vault" } });
    if (!mod || mod.status !== "inventory") {
      throw new GameError(400, "MOD_UNAVAILABLE", "That modification is not in your inventory.");
    }
    const def = vaultModById(mod.modId);
    if (!def) throw new GameError(400, "UNKNOWN_MOD", "Unknown modification.");

    if (def.defenseWhenSecuredPercentAtLeast) {
      const vault = await tx.vault.findUnique({ where: { userId } });
      const tier = vault?.tier || "standard";
      const need = def.defenseWhenSecuredPercentAtLeast.minTier;
      const ok = need === "diamond" ? tier === "diamond" : tier === "gold" || tier === "diamond";
      if (!ok) throw new GameError(400, "VAULT_TIER", "That modification needs a Gold or Diamond vault.");
    }

    const installed = await tx.modOwned.findMany({
      where: { userId, kind: "vault", status: "installed" },
      select: { vaultSlot: true },
    });
    if (installed.length >= slots) throw new GameError(400, "SLOTS_FULL", "No free vault modification slots.");
    const used = new Set(installed.map((r) => r.vaultSlot));
    let slot = 0;
    while (used.has(slot)) slot += 1;

    const updated = await tx.modOwned.update({
      where: { id: mod.id },
      data: { status: "installed", vaultSlot: slot },
    });
    return presentMod(updated);
  });
}

export async function removeVaultMod(userId: string, instanceId: string) {
  const mod = await prisma.modOwned.findFirst({
    where: { id: instanceId, userId, kind: "vault", status: "installed" },
  });
  if (!mod) throw new GameError(400, "MOD_NOT_INSTALLED", "That modification is not installed.");
  const updated = await prisma.modOwned.update({
    where: { id: mod.id },
    data: { status: "inventory", vaultSlot: null, activatedAt: null },
  });
  return presentMod(updated);
}

/** activatedAt: null/past = ready; Date(0) = armed for next hit; future = cooldown end. */
export async function activateLockdown(userId: string) {
  const mod = await prisma.modOwned.findFirst({
    where: { userId, modId: "emergency-lockdown", status: "installed" },
  });
  if (!mod) throw new GameError(400, "MOD_NOT_INSTALLED", "Emergency Lockdown is not installed.");
  if (mod.activatedAt && mod.activatedAt.getTime() === 0) {
    throw new GameError(400, "ALREADY_ARMED", "Emergency Lockdown is already armed.");
  }
  if (mod.activatedAt && mod.activatedAt.getTime() > Date.now()) {
    throw new GameError(400, "COOLDOWN", "Emergency Lockdown is still cooling down.");
  }
  const updated = await prisma.modOwned.update({
    where: { id: mod.id },
    data: { activatedAt: new Date(0) },
  });
  return presentMod(updated);
}

export async function weaponModIds(userWeaponId: string): Promise<string[]> {
  const rows = await prisma.modOwned.findMany({
    where: { userWeaponId, status: "installed", kind: "weapon" },
    select: { modId: true },
  });
  return rows.map((r) => r.modId);
}

export async function vaultModIds(userId: string): Promise<string[]> {
  const rows = await prisma.modOwned.findMany({
    where: { userId, status: "installed", kind: "vault" },
    select: { modId: true },
  });
  return rows.map((r) => r.modId);
}

/** Consume one armed lockdown charge after it affected a heist. */
export async function consumeLockdown(userId: string) {
  const mod = await prisma.modOwned.findFirst({
    where: { userId, modId: "emergency-lockdown", status: "installed" },
  });
  if (!mod?.activatedAt || mod.activatedAt.getTime() !== 0) return;
  const def = vaultModById("emergency-lockdown");
  const cd = def?.emergencyLockdown?.cooldownMs ?? 86_400_000;
  await prisma.modOwned.update({
    where: { id: mod.id },
    data: { activatedAt: new Date(Date.now() + cd) },
  });
}

export function lockdownIsArmed(activatedAt: Date | null | undefined): boolean {
  return Boolean(activatedAt && activatedAt.getTime() === 0);
}
