import type { Request, Response } from "express";
import { z } from "zod";
import { GameError } from "../game/errors.js";
import { currentUserId } from "../middleware/auth.js";
import {
  acknowledgeAchievement,
  claimAchievement,
  listAchievements,
  unannouncedAchievements,
} from "../services/achievementService.js";
import { listNotifications, markNotificationRead } from "../services/notificationService.js";
import { buyShopItem, shopView, upgradeCamera } from "../services/shopService.js";
import { getLeaderboard } from "../services/userService.js";

export async function leaderboard(_req: Request, res: Response): Promise<void> {
  res.json(await getLeaderboard());
}

export async function notifications(req: Request, res: Response): Promise<void> {
  res.json({ notifications: await listNotifications(currentUserId(req)) });
}

const idSchema = z.object({ id: z.string().min(1).max(80) }).strict();
const shopSchema = z.object({ itemId: z.string().min(1).max(64) }).strict();

export async function readNotification(req: Request, res: Response): Promise<void> {
  const id = z.string().min(1).max(80).parse(req.params.id);
  const row = await markNotificationRead(currentUserId(req), id);
  if (!row) throw new GameError(404, "NOT_FOUND", "No such report.");
  res.json(row);
}

export async function achievements(req: Request, res: Response): Promise<void> {
  res.json(await listAchievements(currentUserId(req)));
}

export async function achievementAlerts(req: Request, res: Response): Promise<void> {
  res.json({ unlocked: await unannouncedAchievements(currentUserId(req)) });
}

export async function ackAchievement(req: Request, res: Response): Promise<void> {
  const body = idSchema.parse(req.body ?? {});
  res.json(await acknowledgeAchievement(currentUserId(req), body.id));
}

export async function claimAchievementReward(req: Request, res: Response): Promise<void> {
  const body = idSchema.parse(req.body ?? {});
  res.json(await claimAchievement(currentUserId(req), body.id));
}

export async function shop(req: Request, res: Response): Promise<void> {
  res.json(await shopView(currentUserId(req)));
}

export async function buyShop(req: Request, res: Response): Promise<void> {
  const body = shopSchema.parse(req.body ?? {});
  res.status(201).json(await buyShopItem(currentUserId(req), body.itemId));
}

export async function cameraUpgrade(req: Request, res: Response): Promise<void> {
  z.object({}).strict().parse(req.body ?? {});
  res.json(await upgradeCamera(currentUserId(req)));
}
