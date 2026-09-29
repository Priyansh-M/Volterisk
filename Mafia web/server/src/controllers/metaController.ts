import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { getLeaderboard } from "../services/userService.js";

export async function leaderboard(_req: Request, res: Response): Promise<void> {
  res.json(await getLeaderboard());
}

export async function notifications(req: Request, res: Response): Promise<void> {
  const rows = await prisma.notification.findMany({
    where: { userId: currentUserId(req) },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  res.json({
    notifications: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      read: row.read,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
