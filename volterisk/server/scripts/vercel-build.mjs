import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePostgresSchema } from "./write-postgres-schema.mjs";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const name of ["DATABASE_URL", "DIRECT_URL", "JWT_SECRET"]) {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    console.error(`Missing ${name}. Set it on the Vercel project before deploying.`);
    process.exit(1);
  }
}

if (process.env.JWT_SECRET.trim() === "iron-hour-local-dev") {
  console.error("JWT_SECRET is still the local default. Set a new secret on the Vercel project.");
  process.exit(1);
}

writePostgresSchema();

const cli = path.join(serverRoot, "node_modules", "prisma", "build", "index.js");
const result = spawnSync(process.execPath, [cli, "generate", "--schema", "prisma/schema.postgres.prisma"], {
  cwd: serverRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
