import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "client", "dist");
const to = path.join(root, "public");

if (!fs.existsSync(path.join(from, "index.html"))) {
  console.error("client/dist/index.html is missing. The client build did not run.");
  process.exit(1);
}

fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log(`Copied ${from} to ${to}`);
