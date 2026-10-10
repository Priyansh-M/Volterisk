import "dotenv/config";
import express from "express";
import { createApp } from "./app.js";
import {
  configureSqlite,
  ensureBountyTable,
  ensureCareerModsSchema,
  ensureDatabase,
  ensureTerritorySchema,
  usesPostgres,
} from "./prisma.js";
import { setReady } from "./runtime.js";
import { ensureNightCrew } from "./services/nightCrew.js";
import { settlePropertyMaterialYieldsNoonGmt } from "./services/propertyMaterialYieldService.js";
import { settleVaultYieldNoonGmt } from "./services/vaultYieldService.js";

void express;

const app = createApp();

async function boot(): Promise<void> {
  if (process.env.VERCEL) {
    const secret = (process.env.JWT_SECRET ?? "").trim();
    if (!secret || secret === "iron-hour-local-dev") {
      throw new Error("Set JWT_SECRET on the Vercel project. The local default cannot be used online.");
    }
    if (!usesPostgres()) {
      throw new Error("Set DATABASE_URL to the Supabase pooler URL (postgresql://).");
    }
  } else if (usesPostgres() && process.env.ALLOW_REMOTE_DB !== "1") {
    // .env often has the Supabase pooler URL; local servers must not steal session slots from prod.
    throw new Error(
      "Local API refused remote DATABASE_URL (would exhaust Supabase session pool). Use npm run dev (SQLite) or set ALLOW_REMOTE_DB=1.",
    );
  }
  if (!usesPostgres()) {
    await ensureDatabase();
    await configureSqlite();
  } else {
    await ensureBountyTable();
  }
  await ensureTerritorySchema();
  await ensureCareerModsSchema();
  await ensureNightCrew();
  if (!process.env.VERCEL) {
    const tick = () => {
      void settleVaultYieldNoonGmt().catch(() => null);
      void settlePropertyMaterialYieldsNoonGmt().catch(() => null);
    };
    tick();
    setInterval(tick, 15 * 60_000);
  }
}

const pending = boot();
if (process.env.VERCEL) {
  setReady(pending);
} else {
  await pending;
}

export default app;
