import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { upgradeVault, withdrawVault } from "../services/vaultService.js";

const withdrawSchema = z
  .object({
    amount: z.number().int().positive(),
  })
  .strict();

const emptySchema = z.object({}).strict();

export async function upgrade(req: Request, res: Response): Promise<void> {
  emptySchema.parse(req.body ?? {});
  res.json(await upgradeVault(currentUserId(req)));
}

export async function withdraw(req: Request, res: Response): Promise<void> {
  const body = withdrawSchema.parse(req.body ?? {});
  res.json(await withdrawVault(currentUserId(req), body.amount));
}
