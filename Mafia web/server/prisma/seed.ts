import "dotenv/config";
import { randomBytes } from "node:crypto";
import { RULES, effectiveWeaponLevel } from "../src/game/rules.js";
import { NIGHT_CREW, heistableVaultBalance, type NightCrewMember } from "../src/services/nightCrew.js";
import { prisma } from "../src/prisma.js";
import { createPlayer, ensureWeaponCatalog } from "../src/services/userService.js";

async function upsertBot(bot: NightCrewMember) {
  const vaultBalance = heistableVaultBalance(bot.vaultBalance);
  const existing = await prisma.user.findUnique({ where: { usernameKey: bot.username.toLowerCase() } });
  if (!existing) {
    await createPlayer({
      username: bot.username,
      password: randomBytes(24).toString("hex"),
      isBot: true,
      cash: bot.cash,
      vaultBalance,
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
    data: { balance: vaultBalance, level: bot.vaultLevel },
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
  for (const bot of NIGHT_CREW) {
    await upsertBot(bot);
  }
  await seedHistory();
  console.log(`Seeded ${NIGHT_CREW.length} night-crew ledgers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
