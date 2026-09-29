import "dotenv/config";
import { createApp } from "./app.js";
import { configureSqlite } from "./prisma.js";
import { ensureNightCrew } from "./services/nightCrew.js";
import { settleAllPassivePay } from "./services/workService.js";

const port = Number(process.env.PORT ?? 8787);
const host = "0.0.0.0";

await configureSqlite();
await ensureNightCrew();
setInterval(() => {
  void settleAllPassivePay().catch((error) => console.error("passive payday", error));
}, 60_000);

createApp().listen(port, host, () => {
  console.log(`Iron Hour API on http://${host}:${port}`);
});
