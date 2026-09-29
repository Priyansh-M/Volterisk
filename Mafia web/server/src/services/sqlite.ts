import { Prisma } from "@prisma/client";
import { GameError } from "../game/errors.js";

export function isSqliteBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_BUSY|database is locked/i.test(message);
}

export async function withSqliteRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof GameError || !isSqliteBusy(error) || attempt === 3) throw error;
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw last;
}

/** Lowercased constraint text for a P2002, or null when this is some other error. */
export function uniqueConflictText(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return null;
  }
  const target = error.meta?.target;
  const rendered = Array.isArray(target) ? target.join(" ") : String(target ?? "");
  return `${rendered} ${error.message}`.toLowerCase();
}
