import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { vaultRobFinish, vaultRobForfeit, vaultRobStart, vaultRobStatus } from "../services/vaultRobService.js";

export async function robStatus(req: Request, res: Response): Promise<void> {
  res.json(await vaultRobStatus(currentUserId(req)));
}

export async function robStart(req: Request, res: Response): Promise<void> {
  const mode = req.body?.mode === "normal" ? "normal" : "hard";
  res.json(await vaultRobStart(currentUserId(req), mode));
}

export async function robForfeit(req: Request, res: Response): Promise<void> {
  res.json(await vaultRobForfeit(currentUserId(req)));
}

export async function robFinish(req: Request, res: Response): Promise<void> {
  const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
  const clean = steps
    .filter((cell: unknown) => Array.isArray(cell) && cell.length === 2)
    .map((cell: number[]) => [Number(cell[0]), Number(cell[1])]);
  res.json(await vaultRobFinish(currentUserId(req), clean));
}
