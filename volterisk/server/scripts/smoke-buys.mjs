/**
 * End-to-end buy/economy smoke: shop, weapons, properties, black market, vault, core GETs.
 * Run: DATABASE_URL=file:./data/smoke.db node --import tsx scripts/smoke-buys.mjs
 */
import request from "supertest";
import { createApp } from "../src/app.ts";
import {
  configureSqlite,
  ensureBountyTable,
  ensureCareerModsSchema,
  ensureDatabase,
  ensureTerritorySchema,
  prisma,
} from "../src/prisma.ts";
import { setReady } from "../src/runtime.ts";
import { ensureNightCrew } from "../src/services/nightCrew.ts";
import { RULES } from "../src/game/rules.ts";

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
const stamp = Date.now().toString(36);
const pass = "password12";

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function register(name) {
  const reg = await request(app).post("/api/auth/register").send({ username: name, password: pass });
  if (reg.status !== 201 || !reg.body?.token) {
    throw new Error(`register ${name}: ${reg.status} ${JSON.stringify(reg.body).slice(0, 200)}`);
  }
  return { token: reg.body.token, user: reg.body.user };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const buyerName = `Buy${stamp}`;
const sellerName = `Sell${stamp}`;
const buyer = await register(buyerName);
const seller = await register(sellerName);

// Fund both so buys cannot fail on starter cash.
await prisma.user.update({ where: { id: buyer.user.id }, data: { cash: 500_000 } });
await prisma.user.update({ where: { id: seller.user.id }, data: { cash: 500_000 } });
await prisma.inventoryItem.create({
  data: { userId: seller.user.id, itemId: "mat:scrap-components", quantity: 50 },
});

const beforeBuy = await request(app).get("/api/me").set(auth(buyer.token));
assert(beforeBuy.status === 200, `me before: ${beforeBuy.status}`);
const cashBefore = beforeBuy.body.cash;

// --- Shop: estimate predictor ---
const shopBuy = await request(app)
  .post("/api/shop/buy")
  .set(auth(buyer.token))
  .send({ itemId: RULES.ESTIMATE_PREDICTOR_ID });
assert(shopBuy.status === 200 || shopBuy.status === 201, `shop buy: ${shopBuy.status} ${JSON.stringify(shopBuy.body)}`);
assert(typeof shopBuy.body.cash === "number", "shop buy missing cash");
assert(shopBuy.body.cash < cashBefore, "shop buy did not deduct cash");
assert((shopBuy.body.quantity ?? 0) >= 1, "shop buy missing quantity");
console.log("shop/buy predictor ok", shopBuy.body.cash);

// --- Shop: camera ---
const camBuy = await request(app).post("/api/shop/buy").set(auth(buyer.token)).send({ itemId: RULES.CAMERA_ID });
assert(camBuy.status === 200 || camBuy.status === 201, `camera buy: ${camBuy.status} ${JSON.stringify(camBuy.body)}`);
assert(camBuy.body.level === 1, "camera not level 1");
console.log("shop/buy camera ok");

const camUp = await request(app).post("/api/shop/camera/upgrade").set(auth(buyer.token)).send({});
assert(camUp.status === 200, `camera upgrade: ${camUp.status} ${JSON.stringify(camUp.body)}`);
assert(camUp.body.level === 2, "camera not level 2");
console.log("shop/camera/upgrade ok");

// --- Weapon: next in line ---
const nextWeapon = RULES.WEAPONS[1];
const weaponPrice = RULES.WEAPON_BUY_COSTS[nextWeapon.id];
assert(weaponPrice > 0, "next weapon not priced");
const wBuy = await request(app)
  .post("/api/weapons/buy")
  .set(auth(buyer.token))
  .send({ weaponId: nextWeapon.id });
assert(wBuy.status === 201, `weapon buy: ${wBuy.status} ${JSON.stringify(wBuy.body)}`);
assert(wBuy.body.id === nextWeapon.id || wBuy.body.weaponId === nextWeapon.id || wBuy.body.name, "weapon payload odd");
console.log("weapons/buy ok", nextWeapon.id);

const arsenal = await request(app).get("/api/me/weapons").set(auth(buyer.token));
assert(arsenal.status === 200, `arsenal: ${arsenal.status}`);
assert(
  (arsenal.body.owned ?? []).some((w) => w.id === nextWeapon.id || w.weaponId === nextWeapon.id),
  "bought weapon not in arsenal",
);
console.log("arsenal contains weapon ok");

// --- Property: first affordable catalog lot ---
const props = await request(app).get("/api/properties").set(auth(buyer.token));
assert(props.status === 200, `properties: ${props.status}`);
const lot =
  [...(props.body.propertyCatalog ?? []), ...(props.body.vehicleCatalog ?? [])].find((row) => !row.owned && row.price > 0) ??
  null;
assert(lot, "no property lot to buy");
const cashMid = (await request(app).get("/api/me").set(auth(buyer.token))).body.cash;
const pBuy = await request(app).post("/api/properties/buy").set(auth(buyer.token)).send({ catalogId: lot.id });
assert(pBuy.status === 200 || pBuy.status === 201, `property buy: ${pBuy.status} ${JSON.stringify(pBuy.body)}`);
const cashAfterProp = (await request(app).get("/api/me").set(auth(buyer.token))).body.cash;
assert(cashAfterProp < cashMid, "property buy did not deduct cash");
console.log("properties/buy ok", lot.id);

// --- Vault deposit / withdraw ---
const vaultIn = await request(app).post("/api/vault/deposit").set(auth(buyer.token)).send({ amount: 1000 });
assert(vaultIn.status === 200, `vault deposit: ${vaultIn.status} ${JSON.stringify(vaultIn.body)}`);
const vaultOut = await request(app).post("/api/vault/withdraw").set(auth(buyer.token)).send({ amount: 500 });
assert(vaultOut.status === 200, `vault withdraw: ${vaultOut.status} ${JSON.stringify(vaultOut.body)}`);
console.log("vault deposit/withdraw ok");

// --- Black market: list then buy ---
const listing = await request(app)
  .post("/api/black-market/list")
  .set(auth(seller.token))
  .send({ kind: "material", itemId: "mat:scrap-components", quantity: 10, price: 2500 });
assert(listing.status === 200 || listing.status === 201, `bm list: ${listing.status} ${JSON.stringify(listing.body)}`);
const listingId = listing.body.id;
assert(listingId, "listing id missing");

const board = await request(app).get("/api/black-market").set(auth(buyer.token));
assert(board.status === 200, `bm board: ${board.status}`);
assert(
  (board.body.listings ?? []).some((l) => l.id === listingId),
  "listing not on board",
);

const sellerCashBefore = (await request(app).get("/api/me").set(auth(seller.token))).body.cash;
const buyerCashBeforeBm = (await request(app).get("/api/me").set(auth(buyer.token))).body.cash;

const bmBuy = await request(app)
  .post("/api/black-market/buy")
  .set(auth(buyer.token))
  .send({ listingId });
assert(bmBuy.status === 200 || bmBuy.status === 201, `bm buy: ${bmBuy.status} ${JSON.stringify(bmBuy.body)}`);
assert(typeof bmBuy.body.cash === "number", "bm buy missing cash");
assert(bmBuy.body.cash === buyerCashBeforeBm - 2500, `bm buy cash wrong: ${bmBuy.body.cash} vs ${buyerCashBeforeBm - 2500}`);

const boardAfter = await request(app).get("/api/black-market").set(auth(buyer.token));
assert(
  !(boardAfter.body.listings ?? []).some((l) => l.id === listingId),
  "listing still open after buy",
);
const sellerCashAfter = (await request(app).get("/api/me").set(auth(seller.token))).body.cash;
assert(sellerCashAfter > sellerCashBefore, "seller did not receive proceeds");
console.log("black-market list+buy ok");

// --- Work / heists / shop GETs still healthy ---
for (const p of [
  "/api/shop",
  "/api/work/contracts",
  "/api/work/passive",
  "/api/heists/targets",
  "/api/mods",
  "/api/notifications",
  "/api/heat/warning",
]) {
  const res = await request(app).get(p).set(auth(buyer.token));
  assert(res.status === 200, `${p}: ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
  console.log("GET", p, "ok");
}

// --- Login still returns profile ---
const login = await request(app).post("/api/auth/login").send({ username: buyerName, password: pass });
assert(login.status === 200 && login.body.token && login.body.user, `login: ${login.status}`);
console.log("login ok");

console.log("SMOKE_BUYS_OK");
await prisma.$disconnect().catch(() => undefined);
process.exit(0);
