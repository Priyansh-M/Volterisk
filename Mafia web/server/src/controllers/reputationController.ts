import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { claimReputation, getReputation } from "../services/reputationService.js";

export async function reputation(req: Request, res: Response): Promise<void> {
  res.json(await getReputation(currentUserId(req)));
}

export async function claimReputationLevel(req: Request, res: Response): Promise<void> {
  res.json(await claimReputation(currentUserId(req)));
}
