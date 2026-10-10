import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../server/src/index.js";
import { trackPrismaRequest } from "../server/src/prisma.js";

type RequestWithUrl = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
  originalUrl?: string;
};

function headerValue(req: IncomingMessage, name: string): string {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function firstQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Vercel only mounts api/index.ts at /api. Nested paths arrive via rewrite. */
function withApiPrefix(req: RequestWithUrl): string {
  const raw = req.originalUrl || req.url || headerValue(req, "x-forwarded-uri") || headerValue(req, "x-invoke-path") || "/";
  const queryAt = raw.indexOf("?");
  const pathname = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const params = new URLSearchParams(queryAt === -1 ? "" : raw.slice(queryAt + 1));
  const forwarded = params.get("__path") || firstQuery(req.query?.__path);
  params.delete("__path");
  const rest = params.toString();
  const query = rest ? `?${rest}` : "";

  if (pathname.startsWith("/api/") && pathname !== "/api/index" && !pathname.startsWith("/api/index/")) {
    return `${pathname}${query}`;
  }
  const clean = forwarded.replace(/^\/+/, "");
  if (clean) return `/api/${clean}${query}`;
  const trimmed = pathname.replace(/^\/+/, "");
  if (!trimmed || trimmed === "api" || trimmed === "api/index") return `/api${query}`;
  return `/api/${trimmed}${query}`;
}

export default function handler(req: RequestWithUrl, res: ServerResponse): void {
  req.url = withApiPrefix(req);
  // Session-mode pooler slots are scarce — release after the response so idle
  // isolates do not keep holding a client until the next cold recycle.
  trackPrismaRequest(res);
  app(req, res);
}
