import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../server/src/index.js";

type RequestWithQuery = IncomingMessage & {
  query?: { path?: string | string[] };
};

function withApiPrefix(req: RequestWithQuery): string {
  const url = req.url ?? "/";
  const queryAt = url.indexOf("?");
  const pathname = queryAt === -1 ? url : url.slice(0, queryAt);
  const query = queryAt === -1 ? "" : url.slice(queryAt);
  if (pathname === "/api" || pathname.startsWith("/api/")) return url;
  const parts = req.query?.path;
  const rest = Array.isArray(parts) ? parts.filter(Boolean).join("/") : (parts ?? "");
  return rest ? `/api/${rest}${query}` : `/api${query}`;
}

export default function handler(req: RequestWithQuery, res: ServerResponse): void {
  req.url = withApiPrefix(req);
  app(req, res);
}
