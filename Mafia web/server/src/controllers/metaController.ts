import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { listNotifications } from "../services/notificationService.js";
import { getLeaderboard } from "../services/userService.js";

export async function leaderboard(_req: Request, res: Response): Promise<void> {
  res.json(await getLeaderboard());
}

export async function notifications(req: Request, res: Response): Promise<void> {
  res.json({ notifications: await listNotifications(currentUserId(req)) });
}
