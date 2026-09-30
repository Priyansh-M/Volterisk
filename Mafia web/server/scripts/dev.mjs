import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(serverRoot, "node_modules", "tsx", "dist", "cli.mjs");

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
  { cwd: serverRoot, stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
