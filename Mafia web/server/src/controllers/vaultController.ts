import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { syncAchievements } from "../services/achievementService.js";
import { depositVault, setInsurance, upgradeVault, withdrawVault } from "../services/vaultService.js";

const moveSchema = z.union([
  z.object({ amount: z.number().int().positive() }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);

const emptySchema = z.object({}).strict();

export async function upgrade(req: Request, res: Response): Promise<void> {
  emptySchema.parse(req.body ?? {});
  const userId = currentUserId(req);
  const vault = await upgradeVault(userId);
  const unlocked = await syncAchievements(userId);
  res.json({ ...vault, unlocked });
}

const insuranceSchema = z.object({ enabled: z.boolean() }).strict();

export async function insurance(req: Request, res: Response): Promise<void> {
  const body = insuranceSchema.parse(req.body ?? {});
  res.json(await setInsurance(currentUserId(req), body.enabled));
}

export async function withdraw(req: Request, res: Response): Promise<void> {
  const body = moveSchema.parse(req.body ?? {});
  res.json(await withdrawVault(currentUserId(req), "all" in body ? "all" : body.amount));
}

export async function deposit(req: Request, res: Response): Promise<void> {
  const body = moveSchema.parse(req.body ?? {});
  res.json(await depositVault(currentUserId(req), "all" in body ? "all" : body.amount));
}
