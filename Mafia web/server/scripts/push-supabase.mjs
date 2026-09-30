import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePostgresSchema } from "./write-postgres-schema.mjs";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function postgresUrl(name, value) {
  const url = (value ?? "").trim();
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return url;
  console.error(
    `${name} must be a Supabase postgres URL set in this terminal. Do not put it in server/.env (that file is committed, and local play stays on SQLite).`,
  );
  process.exit(1);
}

const databaseUrl = postgresUrl("DATABASE_URL", process.env.DATABASE_URL);
const directUrl = postgresUrl("DIRECT_URL", process.env.DIRECT_URL);

if (directUrl.includes(":6543") || directUrl.includes("pgbouncer=true")) {
  console.error("DIRECT_URL must be the port 5432 session or direct URL, with no pgbouncer=true.");
  process.exit(1);
}
let databaseQuery;
try {
  databaseQuery = new URL(databaseUrl).searchParams;
} catch {
  console.error("DATABASE_URL is not a valid URL. Encode the password, then paste it into the URL.");
  process.exit(1);
}
if (
  !databaseUrl.includes(":6543/") ||
  databaseQuery.get("pgbouncer") !== "true" ||
  databaseQuery.get("connection_limit") !== "1"
) {
  console.error(
    "DATABASE_URL must be the port 6543 transaction pooler URL and include pgbouncer=true and connection_limit=1.",
  );
  process.exit(1);
}

writePostgresSchema();

const cli = path.join(serverRoot, "node_modules", "prisma", "build", "index.js");
const result = spawnSync(
  process.execPath,
  [cli, "db", "push", "--skip-generate", "--schema", "prisma/schema.postgres.prisma"],
  { cwd: serverRoot, stdio: "inherit", env: process.env },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
