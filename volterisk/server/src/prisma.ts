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

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaInflight?: number;
  prismaReleaseEpoch?: number;
};

/**
 * Supabase port 6543 is transaction mode. Prisma interactive `$transaction`
 * callbacks (every cash move) never finish there. Port 5432 is session mode
 * and can run them — but Supabase free tier caps session clients at pool_size
 * (often 15). Each PrismaClient with connection_limit>1, or each idle isolate
 * that never disconnects, burns a slot until EMAXCONNSESSION.
 *
 * Always force connection_limit=1 on the session pooler, and release the
 * connection when no request is in flight (see trackPrismaRequest).
 * Never open nested global-prisma queries inside `$transaction`.
 */
function runtimeDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  if (!(raw.startsWith("postgres://") || raw.startsWith("postgresql://"))) return undefined;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const isSupabasePooler = host.includes("pooler.supabase.com") || host.includes("pooler.supabase");
    const isTxnPort = url.port === "6543";
    // Remap transaction-mode pooler → session mode whenever interactive txs are required.
    if (isTxnPort && (process.env.VERCEL || isSupabasePooler)) {
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
    }
    // Session pool is tiny — never let a single isolate open more than one client.
    url.searchParams.set("connection_limit", "1");
    // Fail fast into a short client/server retry instead of hanging the UI.
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "5");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "8");
    return url.toString();
  } catch {
    return raw;
  }
}

const databaseUrl = runtimeDatabaseUrl();

/** True pool exhaustion only — do not treat mid-request disconnects as "busy" (that broke login). */
export function isDbBusyError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1001" || error.code === "P2024") return true;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /EMAXCONNSESSION|max clients reached|too many clients|timed out fetching a new connection/i.test(msg);
}

/** Short retry on pool pressure. Keep waits small so login/actions do not feel hung. */
export async function withConnRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isDbBusyError(error) || i === attempts - 1) throw error;
      const wait = 150 * 2 ** i + Math.floor(Math.random() * 80);
      console.warn(`[prisma] ${label}: pool busy, retry in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    transactionOptions: {
      maxWait: 8_000,
      timeout: 12_000,
    },
  });
globalForPrisma.prisma = prisma;
globalForPrisma.prismaInflight ??= 0;
globalForPrisma.prismaReleaseEpoch ??= 0;

/**
 * Longer than desk/heat polls so normal browsing reuses one session client.
 * Short 4s disconnects caused reconnect lag on every poll + login.
 */
const IDLE_DISCONNECT_MS = 90_000;

/** Drop the session-mode client when the isolate is idle so other isolates can connect. */
export async function releasePrismaConnection(opts?: { immediate?: boolean }): Promise<void> {
  if ((globalForPrisma.prismaInflight ?? 0) > 0) return;
  const epoch = ++(globalForPrisma.prismaReleaseEpoch as number);
  if (!opts?.immediate) {
    await new Promise<void>((r) => setTimeout(r, IDLE_DISCONNECT_MS));
    if (epoch !== globalForPrisma.prismaReleaseEpoch) return;
    if ((globalForPrisma.prismaInflight ?? 0) > 0) return;
  }
  try {
    await prisma.$disconnect();
  } catch {
    /* already closed */
  }
}

/**
 * Wrap a Vercel request so idle isolates eventually free their session slot.
 * A new request cancels any pending idle disconnect (epoch bump).
 */
export function trackPrismaRequest(res: { once: (event: "finish" | "close", fn: () => void) => void }): void {
  globalForPrisma.prismaInflight = (globalForPrisma.prismaInflight ?? 0) + 1;
  // Cancel any pending idle disconnect — this isolate is active again.
  globalForPrisma.prismaReleaseEpoch = (globalForPrisma.prismaReleaseEpoch ?? 0) + 1;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    globalForPrisma.prismaInflight = Math.max(0, (globalForPrisma.prismaInflight ?? 1) - 1);
    if ((globalForPrisma.prismaInflight ?? 0) === 0 && process.env.VERCEL) {
      void releasePrismaConnection();
    }
  };
  res.once("finish", finish);
  res.once("close", finish);
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
  return withConnRetry("weaponTableExists", () => tableExists(() => prisma.weapon.findFirst({ select: { id: true } })));
}

async function bountyTableExists(): Promise<boolean> {
  return withConnRetry("bountyTableExists", () => tableExists(() => prisma.bounty.findFirst({ select: { id: true } })));
}

async function territoryHoldingExists(): Promise<boolean> {
  return withConnRetry("territoryHoldingExists", () =>
    tableExists(() => prisma.territoryHolding.findFirst({ select: { id: true } })),
  );
}

async function marketListingExists(): Promise<boolean> {
  return withConnRetry("marketListingExists", () =>
    tableExists(() => prisma.marketListing.findFirst({ select: { id: true } })),
  );
}

function pushSchema(): void {
  const cli = path.join(serverRoot, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [cli, "db", "push", "--skip-generate"], {
    cwd: serverRoot,
    // stdin is not a TTY, so a data-loss prompt fails instead of hanging startup.
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
}

/**
 * An empty SQLite file (the engine creates one on first connect) has no Weapon
 * table. ensureNightCrew then throws P2021 at startup and the process exits,
 * which resets the register request the client already opened.
 * Also pushes when newer tables (e.g. Bounty) are missing from an older file.
 * Push with the local Prisma CLI, not npx, so the schema matches this checkout.
 */
export async function ensureDatabase(): Promise<void> {
  const hasWeapons = await weaponTableExists();
  const hasBounties = hasWeapons ? await bountyTableExists() : false;
  if (hasWeapons && hasBounties) return;
  await prisma.$disconnect();
  pushSchema();
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

/** Postgres/Vercel: create Bounty if deploy skipped db push. */
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
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "funded" INTEGER NOT NULL DEFAULT 0`);
  } catch {
    /* sqlite / already there */
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "goal" INTEGER NOT NULL DEFAULT 0`);
  } catch {
    /* sqlite / already there */
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "stolenTotal" INTEGER NOT NULL DEFAULT 0`);
  } catch {
    /* sqlite / already there */
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`);
  } catch {
    /* sqlite / already there */
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
    /* already there */
  }
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Bounty_status_createdAt_idx" ON "Bounty"("status", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Bounty_posterId_targetId_status_idx" ON "Bounty"("posterId", "targetId", "status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Bounty_hunterId_status_idx" ON "Bounty"("hunterId", "status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Bounty_targetId_status_idx" ON "Bounty"("targetId", "status")`);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Bounty"
        ADD CONSTRAINT "Bounty_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
  } catch {
    /* already linked */
  }
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Bounty"
        ADD CONSTRAINT "Bounty_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
  } catch {
    /* already linked */
  }
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Bounty"
        ADD CONSTRAINT "Bounty_hunterId_fkey" FOREIGN KEY ("hunterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
  } catch {
    /* already linked */
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

/** Add L11 territory columns/tables when db push was skipped (esp. Postgres). */
export async function ensureTerritorySchema(): Promise<void> {
  if (territorySchemaReady) return;
  // Fast path: production already has TerritoryHolding — skip a dozen ALTERs per cold start.
  if (await territoryHoldingExists()) {
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
      /* sqlite may not support IF NOT EXISTS on ADD COLUMN */
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

/** Careers + ModOwned + UserWeapon.listed (safe ADD COLUMN / CREATE TABLE). */
export async function ensureCareerModsSchema(): Promise<void> {
  if (careerModsSchemaReady) return;
  // Fast path: MarketListing + ModOwned means black market / mods schema is live.
  if (await marketListingExists()) {
    const hasMods = await withConnRetry("modOwnedProbe", () =>
      tableExists(() => prisma.modOwned.findFirst({ select: { id: true } })),
    );
    if (hasMods) {
      careerModsSchemaReady = true;
      return;
    }
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
        const sqlite = sql
          .replace(" IF NOT EXISTS", "")
          .replace("TIMESTAMP(3)", "DATETIME");
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
      "status" TEXT NOT NULL DEFAULT 'inventory',
      "userWeaponId" TEXT,
      "vaultSlot" INTEGER,
      "activatedAt" ${ts},
      "createdAt" ${ts} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ModOwned_pkey" PRIMARY KEY ("id")
    )
  `);
  for (const idx of [
    `CREATE INDEX IF NOT EXISTS "ModOwned_userId_status_idx" ON "ModOwned"("userId", "status")`,
    `CREATE INDEX IF NOT EXISTS "ModOwned_userId_modId_idx" ON "ModOwned"("userId", "modId")`,
    `CREATE INDEX IF NOT EXISTS "ModOwned_userWeaponId_idx" ON "ModOwned"("userWeaponId")`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(idx);
    } catch {
      /* present */
    }
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CraftingJob" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "recipeId" TEXT NOT NULL,
      "startsAt" ${ts} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completesAt" ${ts} NOT NULL,
      "collectedAt" ${ts},
      "cancelledAt" ${ts},
      "createdAt" ${ts} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CraftingJob_pkey" PRIMARY KEY ("id")
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
