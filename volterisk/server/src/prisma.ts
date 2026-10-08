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
 * Supabase port 6543 is transaction mode. Prisma interactive transactions, which
 * register and every cash move use, never finish there, so the button spins.
 * The same pooler on port 5432 is session mode and can run those transactions.
 */
function runtimeDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!process.env.VERCEL || !raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.port !== "6543") return raw;
    url.port = "5432";
    url.searchParams.delete("pgbouncer");
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
    url.searchParams.set("connect_timeout", "10");
    return url.toString();
  } catch {
    return raw;
  }
}

const databaseUrl = runtimeDatabaseUrl();
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
globalForPrisma.prisma = prisma;

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

/** Postgres/Vercel: create Bounty if deploy skipped db push. */
export async function ensureBountyTable(): Promise<void> {
  if (await bountyTableExists()) return;
  if (!usesPostgres()) {
    await ensureDatabase();
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
}

export async function configureSqlite(): Promise<void> {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 8000");
}
