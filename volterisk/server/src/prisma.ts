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

async function weaponTableExists(): Promise<boolean> {
  try {
    await prisma.weapon.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (missingWeaponTable(error)) return false;
    throw error;
  }
}

/**
 * An empty SQLite file (the engine creates one on first connect) has no Weapon
 * table. ensureNightCrew then throws P2021 at startup and the process exits,
 * which resets the register request the client already opened.
 * Push with the local Prisma CLI, not npx, so the schema matches this checkout.
 */
export async function ensureDatabase(): Promise<void> {
  if (await weaponTableExists()) return;
  await prisma.$disconnect();
  const cli = path.join(serverRoot, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [cli, "db", "push", "--skip-generate"], {
    cwd: serverRoot,
    // stdin is not a TTY, so a data-loss prompt fails instead of hanging startup.
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
  if (!(await weaponTableExists())) {
    throw new Error("Weapon table is still missing. From volterisk/server run: npm run db:push");
  }
}

export async function configureSqlite(): Promise<void> {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 8000");
}
