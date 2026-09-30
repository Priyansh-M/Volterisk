import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { GameError } from "../game/errors.js";
import { prisma } from "../prisma.js";

function jwtSecret(): string {
  return process.env.JWT_SECRET || "iron-hour-local-dev";
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization") ?? "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new GameError(401, "UNAUTHORIZED", "Missing bearer token.");
    }
    const payload = jwt.verify(match[1], jwtSecret()) as { sub?: string; tv?: number };
    if (!payload.sub || typeof payload.tv !== "number") {
      throw new GameError(401, "UNAUTHORIZED", "Invalid token.");
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.tokenVersion !== payload.tv) {
      throw new GameError(401, "UNAUTHORIZED", "Session expired.");
    }
    req.userId = user.id;
    next();
  } catch (error) {
    if (error instanceof GameError) {
      next(error);
      return;
    }
    next(new GameError(401, "UNAUTHORIZED", "Invalid token."));
  }
}

export function currentUserId(req: Request): string {
  if (!req.userId) throw new GameError(401, "UNAUTHORIZED", "Missing session.");
  return req.userId;
}
