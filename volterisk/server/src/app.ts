import path from "node:path";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { GameError } from "./game/errors.js";
import { api } from "./routes/index.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", api);
  if (process.env.VERCEL) {
    const indexHtml = path.join(process.cwd(), "public", "index.html");
    app.use((req, res, next) => {
      if (req.path.startsWith("/api") || path.extname(req.path)) {
        next();
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      res.sendFile(indexHtml, (error) => {
        if (error) next(error);
      });
    });
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
    console.error(error);
    res.status(500).json({ error: "Server error", code: "INTERNAL" });
  });
  return app;
}
