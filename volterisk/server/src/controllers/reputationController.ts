import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { syncAchievements } from "../services/achievementService.js";
import { claimReputation, getReputation } from "../services/reputationService.js";

export async function reputation(req: Request, res: Response): Promise<void> {
  res.json(await getReputation(currentUserId(req)));
}

export async function claimReputationLevel(req: Request, res: Response): Promise<void> {
  const userId = currentUserId(req);
  const file = await claimReputation(userId);
  const unlocked = await syncAchievements(userId).catch(() => []);
  res.json({ ...file, unlocked });
}
