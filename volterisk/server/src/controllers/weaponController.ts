import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { buyWeapon, equipWeapon, repairWeapon, upgradeWeapon } from "../services/weaponService.js";

const weaponBodySchema = z
  .object({
    weaponId: z.string().regex(/^weapon:\d{4}$/),
    instanceId: z.string().min(1).max(40).optional(),
  })
  .strict();

export async function buy(req: Request, res: Response): Promise<void> {
  const body = weaponBodySchema.parse(req.body ?? {});
  res.status(201).json(await buyWeapon(currentUserId(req), body.weaponId));
}

export async function upgrade(req: Request, res: Response): Promise<void> {
  const body = weaponBodySchema.parse(req.body ?? {});
  res.json(await upgradeWeapon(currentUserId(req), body.weaponId, body.instanceId));
}

export async function equip(req: Request, res: Response): Promise<void> {
  const body = weaponBodySchema.parse(req.body ?? {});
  res.json(await equipWeapon(currentUserId(req), body.weaponId, body.instanceId));
}

export async function repair(req: Request, res: Response): Promise<void> {
  const instanceId = z.string().min(1).max(40).parse((req.body as { instanceId?: string })?.instanceId);
  res.json(await repairWeapon(currentUserId(req), instanceId));
}
