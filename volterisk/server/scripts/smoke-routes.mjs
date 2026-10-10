import request from "supertest";
import { createApp } from "../src/app.ts";
import {
  configureSqlite,
  ensureBountyTable,
  ensureCareerModsSchema,
  ensureDatabase,
  ensureTerritorySchema,
} from "../src/prisma.ts";
import { setReady } from "../src/runtime.ts";
import { ensureNightCrew } from "../src/services/nightCrew.ts";

const boot = (async () => {
  await ensureDatabase();
  await configureSqlite();
  await ensureBountyTable();
  await ensureTerritorySchema();
  await ensureCareerModsSchema();
  await ensureNightCrew();
})();
setReady(boot);
await boot;

const app = createApp();
const name = `Smoke${Date.now().toString(36)}`;
const pass = "password12";

const reg = await request(app).post("/api/auth/register").send({ username: name, password: pass });
console.log("register", reg.status, reg.body?.token ? "token-ok" : JSON.stringify(reg.body).slice(0, 200));
if (reg.status !== 201) process.exit(1);

const login = await request(app).post("/api/auth/login").send({ username: name, password: pass });
console.log(
  "login",
  login.status,
  login.body?.token ? "token-ok" : JSON.stringify(login.body).slice(0, 200),
  login.body?.user?.id ? "user-ok" : "no-user",
);
if (login.status !== 200 || !login.body?.token || !login.body?.user) process.exit(1);

const token = login.body.token;
const paths = [
  "/api/me",
  "/api/me/vault",
  "/api/me/weapons",
  "/api/shop",
  "/api/work/contracts",
  "/api/work/passive",
  "/api/heists/targets",
  "/api/heists/history",
  "/api/reputation",
  "/api/black-market",
  "/api/bounties",
  "/api/notifications",
  "/api/achievements",
  "/api/leaderboard",
  "/api/community",
  "/api/map/bases",
  "/api/territory",
  "/api/workshop",
  "/api/mods",
  "/api/heat/warning",
  "/api/properties",
];

let failed = 0;
for (const p of paths) {
  const res = await request(app).get(p).set("Authorization", `Bearer ${token}`);
  // Workshop is reputation-gated for fresh accounts — 403 is healthy.
  const ok = res.status < 400 || (p === "/api/workshop" && res.status === 403);
  if (!ok) failed += 1;
  console.log(res.status, p, ok ? "ok" : JSON.stringify(res.body).slice(0, 160));
}

console.log(failed === 0 ? "SMOKE_OK" : `SMOKE_FAIL ${failed}`);
process.exit(failed === 0 ? 0 : 1);
