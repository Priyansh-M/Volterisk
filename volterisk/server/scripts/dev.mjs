import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(serverRoot, "node_modules", "tsx", "dist", "cli.mjs");

// Default local API to SQLite. A .env that points at the Supabase session
// pooler will otherwise burn free-tier slots (pool_size ~15) and break prod.
const env = { ...process.env };
if (env.ALLOW_REMOTE_DB !== "1") {
  env.DATABASE_URL = "file:./data/dev.db";
  delete env.DIRECT_URL;
}

// SQLite writes data/dev.db, dev.db-wal, and dev.db-shm on register.
// tsx watch treats those as source changes, kills the process, and the
// Vite proxy reports read ECONNRESET / Bad Gateway.
const child = spawn(
  process.execPath,
  [
    tsx,
    "watch",
    "--exclude",
    "**/data/**",
    "--exclude",
    "**/*.db",
    "--exclude",
    "**/*.db-*",
    "src/local.ts",
  ],
  { cwd: serverRoot, stdio: "inherit", env },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
