/**
 * Local SQLite helper: Level 10 player ready to claim Level 11.
 *
 *   DATABASE_URL=file:./data/dev.db npx tsx prisma/seed-territory10.ts
 *
 * Credentials: territory10 / territory10
 *
 * Base sector must exist in client world.ts (velmora has 238 sectors: 0001–0238).
 */
import "dotenv/config";
import { ASSETS } from "../src/services/propertyService.js";
import { prisma } from "../src/prisma.js";
import { createPlayer, ensureWeaponCatalog } from "../src/services/userService.js";

const USERNAME = "territory10";
const PASSWORD = "territory10";
const CASH = 7_000_000;
const VAULT_BALANCE = 750_000;
const ASSET_LEVEL = 5;

/** Prefer mid-map sectors that exist on the chart (0001–0238). */
const BASE_CANDIDATES = [
  { sectorId: "velmora-0120", landmassId: "velmora", regionName: "Inner Shelf", name: "L10 Yard" },
  { sectorId: "velmora-0150", landmassId: "velmora", regionName: "Inner Shelf", name: "L10 Yard" },
  { sectorId: "velmora-0180", landmassId: "velmora", regionName: "East Bight", name: "L10 Yard" },
  { sectorId: "velmora-0100", landmassId: "velmora", regionName: "West Reach", name: "L10 Yard" },
  { sectorId: "velmora-0200", landmassId: "velmora", regionName: "South Keys", name: "L10 Yard" },
];

async function ensureVisibleBase(userId: string) {
  const mine = await prisma.base.findUnique({ where: { userId } });
  if (mine) {
    const index = Number(mine.sectorId.match(/-(\d+)$/)?.[1] ?? 0);
    if (index >= 1 && index <= 238) {
      return mine.sectorId;
    }
    /* Old seed used velmora-0888 which is off-chart — move the pin. */
    await prisma.base.delete({ where: { userId } });
  }

  for (const candidate of BASE_CANDIDATES) {
    const taken = await prisma.base.findUnique({ where: { sectorId: candidate.sectorId } });
    if (taken) continue;
    const holding = await prisma.territoryHolding.findUnique({ where: { sectorId: candidate.sectorId } });
    if (holding) continue;
    await prisma.base.create({
      data: {
        userId,
        sectorId: candidate.sectorId,
        landmassId: candidate.landmassId,
        regionName: candidate.regionName,
        name: candidate.name,
      },
    });
    return candidate.sectorId;
  }
  throw new Error("No free on-chart sector for the test base. Free one of velmora-0120…0200.");
}

async function main() {
  await ensureWeaponCatalog();

  const key = USERNAME.toLowerCase();
  let user = await prisma.user.findUnique({ where: { usernameKey: key } });
  if (!user) {
    user = await createPlayer({
      username: USERNAME,
      password: PASSWORD,
      cash: CASH,
      vaultBalance: VAULT_BALANCE,
      vaultLevel: 5,
    });
    console.log(`Created ${USERNAME}`);
  } else {
    console.log(`Updating existing ${USERNAME}`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      cash: CASH,
      reputationLevel: 10,
      passiveJobId: "convoy-desk",
      vaultCreditCard: false,
      policeAttention: 0,
      starterClaimedAt: new Date(),
    },
  });

  await prisma.vault.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      balance: VAULT_BALANCE,
      level: 5,
      tier: "diamond",
    },
    update: {
      balance: VAULT_BALANCE,
      level: 5,
      tier: "diamond",
    },
  });

  for (const asset of ASSETS) {
    const existing = await prisma.property.findFirst({
      where: { userId: user.id, catalogId: asset.id },
    });
    if (existing) {
      await prisma.property.update({
        where: { id: existing.id },
        data: { level: Math.max(existing.level, ASSET_LEVEL) },
      });
    } else {
      await prisma.property.create({
        data: { userId: user.id, catalogId: asset.id, level: ASSET_LEVEL },
      });
    }
  }

  await prisma.expansionOp.updateMany({
    where: { userId: user.id, closedAt: null },
    data: { closedAt: new Date() },
  });
  await prisma.territoryHolding.deleteMany({ where: { userId: user.id } });

  const baseSector = await ensureVisibleBase(user.id);

  const owned = await prisma.property.count({ where: { userId: user.id } });
  const vault = await prisma.vault.findUnique({ where: { userId: user.id } });
  const refreshed = await prisma.user.findUnique({
    where: { id: user.id },
    select: { reputationLevel: true, cash: true, username: true },
  });
  console.log(
    JSON.stringify(
      {
        username: USERNAME,
        password: PASSWORD,
        level: refreshed?.reputationLevel,
        cash: refreshed?.cash,
        assets: owned,
        vault: vault ? { balance: vault.balance, tier: vault.tier, level: vault.level } : null,
        base: baseSector,
        next: "POST /api/reputation/claim when ready (L11 fee $2M)",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
