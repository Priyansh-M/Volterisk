import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { GameError } from "../game/errors.js";
import { isDbBusyError, prisma, withConnRetry } from "../prisma.js";

function jwtSecret(): string {
  return process.env.JWT_SECRET || "iron-hour-local-dev";
}

/** Short-lived ok sessions so desk/heat polls do not hit User on every request. */
const sessionOkUntil = new Map<string, number>();
const SESSION_CACHE_MS = 25_000;

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
    const cacheKey = `${payload.sub}:${payload.tv}`;
    if ((sessionOkUntil.get(cacheKey) ?? 0) > Date.now()) {
      req.userId = payload.sub;
      next();
      return;
    }
    const user = await withConnRetry(
      "auth.session",
      () =>
        prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, tokenVersion: true },
        }),
      2,
    );
    if (!user || user.tokenVersion !== payload.tv) {
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
    if (isDbBusyError(error)) {
      next(new GameError(503, "DB_BUSY", "The ledger is busy. Try again in a moment."));
      return;
    }
    next(new GameError(401, "UNAUTHORIZED", "Invalid token."));
  }
}

export function currentUserId(req: Request): string {
  if (!req.userId) throw new GameError(401, "UNAUTHORIZED", "Missing session.");
  return req.userId;
}
