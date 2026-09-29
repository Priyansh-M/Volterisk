import "dotenv/config";
import { createApp } from "./app.js";
import { configureSqlite } from "./prisma.js";
import { ensureWeaponCatalog } from "./services/userService.js";

const port = Number(process.env.PORT ?? 8787);
const host = "0.0.0.0";

await configureSqlite();
await ensureWeaponCatalog();

createApp().listen(port, host, () => {
  console.log(`Iron Hour API on http://${host}:${port}`);
});
