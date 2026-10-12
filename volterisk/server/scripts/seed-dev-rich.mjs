/**
 * Local SQLite sandbox account: L30, $10M cash, 100× every material.
 * Run from volterisk/server with DATABASE_URL=file:./data/dev.db
 *
 * Login: EliteSandbox / password12
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { MATERIALS } from "../src/game/workshopEconomy.ts";
import { RULES } from "../src/game/rules.ts";
import { ensureWeaponCatalog } from "../src/services/userService.ts";

process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./data/dev.db";
delete process.env.DIRECT_URL;

const prisma = new PrismaClient();
const USERNAME = "EliteSandbox";
const PASS = "password12";

await ensureWeaponCatalog();

const usernameKey = USERNAME.toLowerCase();
const passwordHash = await bcrypt.hash(PASS, 10);
const starter = RULES.WEAPONS[0];

let user = await prisma.user.findUnique({ where: { usernameKey } });
if (!user) {
  user = await prisma.user.create({
    data: {
      username: USERNAME,
      usernameKey,
      passwordHash,
      cash: 10_000_000,
      reputationLevel: 30,
      vaultCreditCard: true,
      vault: {
        create: { balance: 2_000_000, level: 5, tier: "diamond" },
      },
      weapons: {
        create: {
          weaponId: starter.id,
          upgradeLevel: 1,
          durability: 50,
          maxDurability: 50,
          equipped: true,
        },
      },
      base: {
        create: {
          sectorId: "velmora-0210",
          landmassId: "velmora",
          regionName: "South Keys",
          name: "Sandbox HQ",
        },
      },
      properties: {
        create: [
          { catalogId: "workshop", level: 10 },
          { catalogId: "garage", level: 10 },
          { catalogId: "warehouse", level: 8 },
          { catalogId: "front", level: 7 },
          { catalogId: "estate", level: 1 },
          { catalogId: "chop-shop", level: 10 },
        ],
      },
    },
  });
} else {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      cash: 10_000_000,
      reputationLevel: 30,
      vaultCreditCard: true,
    },
  });
  await prisma.vault.upsert({
    where: { userId: user.id },
    update: { balance: 2_000_000, level: 5, tier: "diamond" },
    create: { userId: user.id, balance: 2_000_000, level: 5, tier: "diamond" },
  });
}

for (const mat of MATERIALS) {
  await prisma.inventoryItem.upsert({
    where: { userId_itemId: { userId: user.id, itemId: mat.id } },
    update: { quantity: 100 },
    create: { userId: user.id, itemId: mat.id, quantity: 100 },
  });
}

// Blueprints for advanced crafts
const bps = [
  "phase-alignment-core",
  "predictive-breach-module",
  "self-calibrating-assembly",
  "overdrive-mechanism",
  "aegis-defence-core",
  "predictive-security-matrix",
  "distributed-barrier-network",
  "blacksite-containment-system",
  "sector-pigment-kit",
  "overbuilt-frame",
];
for (const modId of bps) {
  const itemId = `bp:${modId}`;
  await prisma.inventoryItem.upsert({
    where: { userId_itemId: { userId: user.id, itemId } },
    update: { quantity: 5 },
    create: { userId: user.id, itemId, quantity: 5 },
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      username: USERNAME,
      password: PASS,
      level: 30,
      cash: 10_000_000,
      materials: MATERIALS.length,
      each: 100,
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
