import "dotenv/config";
import express from "express";
import { createApp } from "./app.js";
import { configureSqlite, ensureBountyTable, ensureDatabase, usesPostgres } from "./prisma.js";
import { setReady } from "./runtime.js";
import { ensureNightCrew } from "./services/nightCrew.js";

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
  }
  if (!usesPostgres()) {
    await ensureDatabase();
    await configureSqlite();
  } else {
    await ensureBountyTable();
  }
  await ensureNightCrew();
}

const pending = boot();
if (process.env.VERCEL) {
  setReady(pending);
} else {
  await pending;
}

export default app;
