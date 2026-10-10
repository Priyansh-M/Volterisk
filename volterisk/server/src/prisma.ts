import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function usesPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

if (!usesPostgres()) {
  fs.mkdirSync(path.join(serverRoot, "data"), { recursive: true });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Supabase :6543 = transaction pooler (breaks interactive $transaction).
 * Remap to session :5432. Keep connection_limit=1 per isolate so serverless
 * does not open a pile of clients — but do NOT disconnect after every request
 * (that caused reconnect lag and login "Server error").
 */
function runtimeDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  if (!(raw.startsWith("postgres://") || raw.startsWith("postgresql://"))) return undefined;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const isSupabasePooler = host.includes("pooler.supabase.com") || host.includes("pooler.supabase");
    if (url.port === "6543" && (process.env.VERCEL || isSupabasePooler)) {
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
    }
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "10");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    return raw;
  }
}

const databaseUrl = runtimeDatabaseUrl();

/**
 * Pool / engine race — map to 503 DB_BUSY.
 * Never treat these as a bad JWT (that logged people out).
 */
export function isDbBusyError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1001" || error.code === "P2024") return true;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = error.message;
    if (/Engine is not yet connected|not yet connected|Connection .* closed|Server has closed the connection/i.test(msg)) {
      return true;
    }
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /EMAXCONNSESSION|max clients reached|too many clients|timed out fetching a new connection|Engine is not yet connected|not yet connected/i.test(
    msg,
  );
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    transactionOptions: {
      maxWait: 10_000,
      timeout: 15_000,
    },
  });
globalForPrisma.prisma = prisma;

/** Warm the engine during boot so the first HTTP request is not racing connect. */
export async function ensurePrismaConnected(): Promise<void> {
  await prisma.$connect();
}

/**
 * @deprecated No-op. Idle $disconnect after requests caused
 * "Engine is not yet connected" on Vercel — never disconnect between HTTP requests.
 */
export async function releasePrismaConnection(_opts?: { immediate?: boolean }): Promise<void> {
  /* intentionally empty */
}

/**
 * @deprecated No-op. Kept so older api/index call sites compile; do not reconnect disconnect logic.
 */
export function trackPrismaRequest(_res: { once: (event: "finish" | "close", fn: () => void) => void }): void {
  /* intentionally empty */
}

function missingWeaponTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

async function tableExists(probe: () => Promise<unknown>): Promise<boolean> {
  try {
    await probe();
    return true;
  } catch (error) {
    if (missingWeaponTable(error)) return false;
    throw error;
  }
}

async function weaponTableExists(): Promise<boolean> {
  return tableExists(() => prisma.weapon.findFirst({ select: { id: true } }));
}

async function bountyTableExists(): Promise<boolean> {
  return tableExists(() => prisma.bounty.findFirst({ select: { id: true } }));
}

async function territoryHoldingExists(): Promise<boolean> {
  return tableExists(() => prisma.territoryHolding.findFirst({ select: { id: true } }));
}

async function marketListingExists(): Promise<boolean> {
  return tableExists(() => prisma.marketListing.findFirst({ select: { id: true } }));
}

function pushSchema(): void {
  const cli = path.join(serverRoot, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [cli, "db", "push", "--skip-generate"], {
    cwd: serverRoot,
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
}

export async function ensureDatabase(): Promise<void> {
  const hasWeapons = await weaponTableExists();
  const hasBounties = hasWeapons ? await bountyTableExists() : false;
  if (hasWeapons && hasBounties) return;
  // Local SQLite schema push only — reconnect immediately after.
  await prisma.$disconnect();
  pushSchema();
  await prisma.$connect();
  if (!(await weaponTableExists())) {
    throw new Error("Weapon table is still missing. From volterisk/server run: npm run db:push");
  }
  if (!(await bountyTableExists())) {
    throw new Error("Bounty table is still missing. From volterisk/server run: npm run db:push");
  }
}

let bountySchemaReady = false;
let territorySchemaReady = false;
let careerModsSchemaReady = false;

export async function ensureBountyTable(): Promise<void> {
  if (bountySchemaReady) return;
  if (await bountyTableExists()) {
    bountySchemaReady = true;
    return;
  }
  if (!usesPostgres()) {
    await ensureDatabase();
    bountySchemaReady = true;
    return;
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Bounty" (
      "id" TEXT NOT NULL,
      "posterId" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "funded" INTEGER NOT NULL DEFAULT 0,
      "goal" INTEGER NOT NULL DEFAULT 0,
      "stolenTotal" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'open',
      "hunterId" TEXT,
      "huntStartedAt" TIMESTAMP(3),
      "heistId" TEXT,
      "claimedAt" TIMESTAMP(3),
      "cancelledAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Bounty_pkey" PRIMARY KEY ("id")
    )
  `);
  for (const sql of [
    `ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "funded" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "goal" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "stolenTotal" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* present */
    }
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BountyFund" (
      "id" TEXT NOT NULL,
      "bountyId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BountyFund_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BountyCut" (
      "id" TEXT NOT NULL,
      "bountyId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "stolen" INTEGER NOT NULL DEFAULT 0,
      "paid" INTEGER NOT NULL DEFAULT 0,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BountyCut_pkey" PRIMARY KEY ("id")
    )
  `);
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "BountyCut_bountyId_userId_key" ON "BountyCut"("bountyId", "userId")`,
    );
  } catch {
    /* present */
  }
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Bounty_status_createdAt_idx" ON "Bounty"("status", "createdAt")`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Bounty_posterId_targetId_status_idx" ON "Bounty"("posterId", "targetId", "status")`,
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Bounty_hunterId_status_idx" ON "Bounty"("hunterId", "status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Bounty_targetId_status_idx" ON "Bounty"("targetId", "status")`);
  for (const sql of [
    `ALTER TABLE "Bounty" ADD CONSTRAINT "Bounty_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "Bounty" ADD CONSTRAINT "Bounty_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "Bounty" ADD CONSTRAINT "Bounty_hunterId_fkey" FOREIGN KEY ("hunterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* linked */
    }
  }
  if (!(await bountyTableExists())) {
    throw new Error("Bounty table could not be created. Run npm run db:push:supabase from volterisk/server.");
  }
  bountySchemaReady = true;
}

export async function configureSqlite(): Promise<void> {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 8000");
}

export async function ensureTerritorySchema(): Promise<void> {
  if (territorySchemaReady) return;
  if (await territoryHoldingExists().catch(() => false)) {
    // Still ensure mapColor exists on older DBs.
    try {
      await prisma.$executeRawUnsafe(
        usesPostgres()
          ? `ALTER TABLE "TerritoryHolding" ADD COLUMN IF NOT EXISTS "mapColor" TEXT`
          : `ALTER TABLE "TerritoryHolding" ADD COLUMN "mapColor" TEXT`,
      );
    } catch {
      /* present */
    }
    territorySchemaReady = true;
    return;
  }
  const alters = [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "policeAttention" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "policeSettledOn" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vaultCreditCard" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastVaultYieldAt" TIMESTAMP(3)`,
  ];
  for (const sql of alters) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      try {
        const sqlite = sql
          .replace(" IF NOT EXISTS", "")
          .replace("BOOLEAN NOT NULL DEFAULT false", "BOOLEAN NOT NULL DEFAULT 0")
          .replace("TIMESTAMP(3)", "DATETIME");
        await prisma.$executeRawUnsafe(sqlite);
      } catch {
        /* already present */
      }
    }
  }
  const ts = usesPostgres() ? "TIMESTAMP(3)" : "DATETIME";
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TerritoryHolding" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "sectorId" TEXT NOT NULL,
      "landmassId" TEXT NOT NULL,
      "regionName" TEXT NOT NULL,
      "specialization" TEXT,
      "securedAt" ${ts} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" ${ts} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TerritoryHolding_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ExpansionOp" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "sectorId" TEXT NOT NULL,
      "landmassId" TEXT NOT NULL,
      "regionName" TEXT NOT NULL,
      "stage" TEXT NOT NULL,
      "completesAt" ${ts},
      "closedAt" ${ts},
      "createdAt" ${ts} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExpansionOp_pkey" PRIMARY KEY ("id")
    )
  `);
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "TerritoryHolding_sectorId_key" ON "TerritoryHolding"("sectorId")`,
    );
  } catch {
    /* present */
  }
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TerritoryHolding_userId_idx" ON "TerritoryHolding"("userId")`);
  } catch {
    /* present */
  }
  try {
    await prisma.$executeRawUnsafe(
      usesPostgres()
        ? `ALTER TABLE "TerritoryHolding" ADD COLUMN IF NOT EXISTS "mapColor" TEXT`
        : `ALTER TABLE "TerritoryHolding" ADD COLUMN "mapColor" TEXT`,
    );
  } catch {
    /* present */
  }
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExpansionOp_userId_closedAt_idx" ON "ExpansionOp"("userId", "closedAt")`);
  } catch {
    /* present */
  }
  territorySchemaReady = true;
}

export async function ensureCareerModsSchema(): Promise<void> {
  if (careerModsSchemaReady) return;
  if (await marketListingExists().catch(() => false)) {
    careerModsSchemaReady = true;
    return;
  }
  const userCols = [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primaryCareer" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "secondaryCareer" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "careerChangedAt" TIMESTAMP(3)`,
  ];
  for (const sql of userCols) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      try {
        const sqlite = sql.replace(" IF NOT EXISTS", "").replace("TIMESTAMP(3)", "DATETIME");
        await prisma.$executeRawUnsafe(sqlite);
      } catch {
        /* present */
      }
    }
  }
  try {
    await prisma.$executeRawUnsafe(
      usesPostgres()
        ? `ALTER TABLE "UserWeapon" ADD COLUMN IF NOT EXISTS "listed" BOOLEAN NOT NULL DEFAULT false`
        : `ALTER TABLE "UserWeapon" ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT 0`,
    );
  } catch {
    /* present */
  }
  const ts = usesPostgres() ? "TIMESTAMP(3)" : "DATETIME";
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ModOwned" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "modId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'owned',
      "weaponInstanceId" TEXT,
      "activatedAt" ${ts},
      "createdAt" ${ts} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ModOwned_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MarketListing" (
      "id" TEXT NOT NULL,
      "sellerId" TEXT NOT NULL,
      "buyerId" TEXT,
      "kind" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "price" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'open',
      "userWeaponId" TEXT,
      "modOwnedId" TEXT,
      "expiresAt" ${ts} NOT NULL,
      "soldAt" ${ts},
      "cancelledAt" ${ts},
      "createdAt" ${ts} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
    )
  `);
  careerModsSchemaReady = true;
}
