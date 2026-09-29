import "dotenv/config";
import { randomBytes } from "node:crypto";
import { RULES, effectiveWeaponLevel } from "../src/game/rules.js";
import { prisma } from "../src/prisma.js";
import { createPlayer, ensureWeaponCatalog } from "../src/services/userService.js";

const bots = [
  { username: "Mara Voss", cash: 12_000, vaultBalance: 18_000, vaultLevel: 1 },
  { username: "Eddie Quill", cash: 8_000, vaultBalance: 42_000, vaultLevel: 1 },
  { username: "Nia Pell", cash: 22_000, vaultBalance: 96_000, vaultLevel: 2 },
  { username: "Hugo Brandt", cash: 15_000, vaultBalance: 80_000, vaultLevel: 4 },
  { username: "Colette Marsh", cash: 40_000, vaultBalance: 240_000, vaultLevel: 3 },
  { username: "Felix Dunn", cash: 90_000, vaultBalance: 880_000, vaultLevel: 6 },
  { username: "Ruth Keene", cash: 6_000, vaultBalance: 55_000, vaultLevel: 2 },
  { username: "Samir Odeh", cash: 120_000, vaultBalance: 1_500_000, vaultLevel: 8 },
  { username: "Inez Calder", cash: 3_000, vaultBalance: 12_000, vaultLevel: 1 },
  { username: "Paulie Tran", cash: 18_000, vaultBalance: 300_000, vaultLevel: 5 },
];

async function upsertBot(bot: (typeof bots)[number]) {
  const existing = await prisma.user.findUnique({ where: { usernameKey: bot.username.toLowerCase() } });
  if (!existing) {
    await createPlayer({
      username: bot.username,
      password: randomBytes(24).toString("hex"),
      isBot: true,
      cash: bot.cash,
      vaultBalance: bot.vaultBalance,
      vaultLevel: bot.vaultLevel,
    });
    return;
  }
  await prisma.user.update({
    where: { id: existing.id },
    data: { cash: bot.cash, isBot: true },
  });
  await prisma.vault.update({
    where: { userId: existing.id },
    data: { balance: bot.vaultBalance, level: bot.vaultLevel },
  });
}

async function seedHistory() {
  const existing = await prisma.heist.count();
  if (existing > 0) return;

  const felix = await prisma.user.findUnique({ where: { usernameKey: "felix dunn" } });
  const colette = await prisma.user.findUnique({ where: { usernameKey: "colette marsh" } });
  const mara = await prisma.user.findUnique({ where: { usernameKey: "mara voss" } });
  const eddie = await prisma.user.findUnique({ where: { usernameKey: "eddie quill" } });
  if (!felix || !colette || !mara || !eddie) return;

  const weapon = RULES.WEAPONS[1];
  const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const older = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const big = await prisma.heist.create({
    data: {
      attackerId: felix.id,
      targetId: colette.id,
      weaponId: weapon.id,
      weaponLevel: effectiveWeaponLevel(weapon.number, 1),
      vaultLevel: 3,
      successChance: 68,
      success: true,
      amountStolen: 42_000,
      createdAt: older,
    },
  });
  await prisma.transaction.create({
    data: {
      type: "heist_payout",
      amount: 42_000,
      fromUserId: colette.id,
      toUserId: felix.id,
      heistId: big.id,
      createdAt: older,
    },
  });

  await prisma.heist.create({
    data: {
      attackerId: mara.id,
      targetId: eddie.id,
      weaponId: RULES.WEAPONS[0].id,
      weaponLevel: 1,
      vaultLevel: 1,
      successChance: 60,
      success: true,
      amountStolen: 1_800,
      createdAt: longAgo,
    },
  });
}

async function main() {
  await ensureWeaponCatalog();
  for (const bot of bots) {
    await upsertBot(bot);
  }
  await seedHistory();
  console.log(`Seeded ${bots.length} night-crew ledgers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
