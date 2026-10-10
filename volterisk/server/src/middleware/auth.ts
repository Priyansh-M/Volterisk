import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { GameError } from "../game/errors.js";
import { isDbBusyError, prisma, withDbRetry } from "../prisma.js";

function jwtSecret(): string {
  return process.env.JWT_SECRET || "iron-hour-local-dev";
}

/** Short positive cache keyed by sub:tv — logout bumps tv so old keys never match. */
const sessionOkUntil = new Map<string, number>();
const SESSION_CACHE_MS = 45_000;

/** Auth with pool-safe DB check. Cache cuts findUnique spam; never maps busy → 401. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization") ?? "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new GameError(401, "UNAUTHORIZED", "Missing bearer token.");
    }
    let payload: { sub?: string; tv?: number };
    try {
      payload = jwt.verify(match[1], jwtSecret()) as { sub?: string; tv?: number };
    } catch {
      throw new GameError(401, "UNAUTHORIZED", "Invalid token.");
    }
    if (!payload.sub || typeof payload.tv !== "number") {
      throw new GameError(401, "UNAUTHORIZED", "Invalid token.");
    }
    const sub = payload.sub;
    const tv = payload.tv;
    const cacheKey = `${sub}:${tv}`;
    const cachedUntil = sessionOkUntil.get(cacheKey);
    if (cachedUntil && cachedUntil > Date.now()) {
      req.userId = sub;
      next();
      return;
    }
    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: sub },
        select: { id: true, tokenVersion: true },
      }),
    );
    if (!user || user.tokenVersion !== tv) {
      sessionOkUntil.delete(cacheKey);
      throw new GameError(401, "UNAUTHORIZED", "Session expired.");
    }
    sessionOkUntil.set(cacheKey, Date.now() + SESSION_CACHE_MS);
    req.userId = user.id;
    next();
  } catch (error) {
    if (error instanceof GameError) {
      next(error);
      return;
    }
    // Pool pressure is not a bad password / expired session.
    if (isDbBusyError(error)) {
      next(new GameError(503, "DB_BUSY", "The ledger is busy. Try again in a moment."));
      return;
    }
    console.error("[auth]", error);
    next(new GameError(503, "DB_BUSY", "The ledger is busy. Try again in a moment."));
  }
}

export function currentUserId(req: Request): string {
  if (!req.userId) throw new GameError(401, "UNAUTHORIZED", "Missing session.");
  return req.userId;
}
