import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { buyWeapon, equipWeapon, upgradeWeapon } from "../services/weaponService.js";

const weaponBodySchema = z
  .object({
    weaponId: z.string().regex(/^weapon:\d{4}$/),
  })
  .strict();

export async function buy(req: Request, res: Response): Promise<void> {
  const body = weaponBodySchema.parse(req.body ?? {});
  res.status(201).json(await buyWeapon(currentUserId(req), body.weaponId));
}

export async function upgrade(req: Request, res: Response): Promise<void> {
  const body = weaponBodySchema.parse(req.body ?? {});
  res.json(await upgradeWeapon(currentUserId(req), body.weaponId));
}

export async function equip(req: Request, res: Response): Promise<void> {
  const body = weaponBodySchema.parse(req.body ?? {});
  res.json(await equipWeapon(currentUserId(req), body.weaponId));
}
