import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { spinRoulette } from "../services/casinoService.js";

export async function spin(req: Request, res: Response): Promise<void> {
  const bets = Array.isArray(req.body?.bets) ? req.body.bets : [];
  res.json(await spinRoulette(currentUserId(req), bets));
}
