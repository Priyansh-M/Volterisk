import "dotenv/config";
import express from "express";
import { createApp } from "./app.js";
import { configureSqlite, ensureDatabase, usesPostgres } from "./prisma.js";
import { setReady } from "./runtime.js";
import { ensureNightCrew } from "./services/nightCrew.js";
import { settleAllHeat } from "./services/heatService.js";
import { settleAllPassivePay } from "./services/workService.js";

void express;

const app = createApp();

async function boot(): Promise<void> {
  if (process.env.VERCEL) {
    const secret = (process.env.JWT_SECRET ?? "").trim();
    if (!secret || secret === "iron-hour-local-dev") {
      throw new Error("Set JWT_SECRET on the Vercel project. The local default cannot be used online.");
    }
    if (!usesPostgres()) {
      throw new Error("Set DATABASE_URL to the Supabase transaction pooler URL (postgresql://, port 6543).");
    }
  }
  if (!usesPostgres()) {
    await ensureDatabase();
    await configureSqlite();
  }
  await ensureNightCrew();
  await settleAllHeat().catch((error) => console.error("heat", error));
  await settleAllPassivePay().catch((error) => console.error("passive payday", error));
}

if (process.env.VERCEL) setReady(boot());
else await boot();

export default app;
