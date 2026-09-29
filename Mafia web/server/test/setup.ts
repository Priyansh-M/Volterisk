import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

const serverRoot = path.resolve(import.meta.dirname, "..");
fs.mkdirSync(path.join(serverRoot, "data"), { recursive: true });

process.env.DATABASE_URL = "file:../data/test.db";
process.env.JWT_SECRET = "test-secret";
process.env.BCRYPT_ROUNDS = "4";
process.env.NODE_ENV = "test";

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  cwd: serverRoot,
  env: process.env,
  stdio: "inherit",
});

beforeEach(async () => {
  const { prisma, configureSqlite } = await import("../src/prisma.js");
  const { ensureWeaponCatalog } = await import("../src/services/userService.js");
  await configureSqlite();
  await prisma.notification.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.heist.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.contractRun.deleteMany();
  await prisma.property.deleteMany();
  await prisma.base.deleteMany();
  await prisma.userWeapon.deleteMany();
  await prisma.vault.deleteMany();
  await prisma.user.deleteMany();
  await prisma.weapon.deleteMany();
  await ensureWeaponCatalog();
});

afterEach(async () => {
  const { setHeistRng } = await import("../src/services/heistService.js");
  setHeistRng(null);
});
