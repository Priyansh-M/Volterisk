import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { GameError } from "./game/errors.js";
import { ensurePrismaConnected, isDbBusyError, trackPrismaRequest } from "./prisma.js";
import { api } from "./routes/index.js";
import { bootError, ready } from "./runtime.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) {
      next();
      return;
    }
    // Hold one session slot only while this response is alive; reconnect before work.
    trackPrismaRequest(res);
    void ready
      .then(async () => {
        if (bootError) {
          res.status(500).json({ error: bootError.message, code: "BOOT" });
          return;
        }
        try {
          await ensurePrismaConnected();
          next();
        } catch (error) {
          if (isDbBusyError(error)) {
            res.status(503).json({
              error: "The ledger is busy. Try again in a moment.",
              code: "DB_BUSY",
            });
            return;
          }
          next(error);
        }
      })
      .catch(next);
  });
  app.use("/api", api);
  app.use("/api", (req, res) => {
    res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}`, code: "NOT_FOUND" });
  });
  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api")) {
      next(error);
      return;
    }
    if (error instanceof GameError) {
      res.status(error.status).json({
        error: error.message,
        code: error.code,
        ...(error.details ?? {}),
      });
      return;
    }
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Invalid input",
        code: "VALIDATION",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    if (isDbBusyError(error)) {
      res.status(503).json({
        error: "The ledger is busy. Try again in a moment.",
        code: "DB_BUSY",
      });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Server error", code: "INTERNAL" });
  });
  return app;
}
