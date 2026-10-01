import type { Request, Response } from "express";
import { z } from "zod";
import { GameError } from "../game/errors.js";
import { RULES } from "../game/rules.js";
import { currentUserId } from "../middleware/auth.js";
import { syncAchievements } from "../services/achievementService.js";
import { claimBase, listBases, renameBase } from "../services/baseService.js";

const claimSchema = z
  .object({
    sectorId: z.string().trim().min(1).max(RULES.SECTOR_ID_MAX_LENGTH).regex(RULES.SECTOR_ID_PATTERN),
    landmassId: z.string().trim().min(1).max(RULES.LANDMASS_ID_MAX_LENGTH).regex(RULES.SECTOR_ID_PATTERN),
    regionName: z.string().trim().min(1).max(RULES.REGION_NAME_MAX_LENGTH),
    name: z.string().trim().max(32).optional(),
  })
  .strict();

const renameSchema = z.object({ name: z.string().trim().min(1).max(32) }).strict();

export async function rename(req: Request, res: Response): Promise<void> {
  const body = renameSchema.parse(req.body ?? {});
  res.json({ base: await renameBase(currentUserId(req), body.name) });
}

export async function bases(req: Request, res: Response): Promise<void> {
  res.json(await listBases(currentUserId(req)));
}

export async function claim(req: Request, res: Response): Promise<void> {
  const body = claimSchema.parse(req.body ?? {});
  try {
    const userId = currentUserId(req);
    const { sectorId, landmassId, regionName, name } = body;
    if (!sectorId || !landmassId || !regionName) {
      throw new GameError(400, "VALIDATION", "Map claim is missing a field.");
    }
    const claimed = await claimBase(userId, { sectorId, landmassId, regionName, name });
    const unlocked = await syncAchievements(userId);
    res.status(201).json({ ...claimed, unlocked });
  } catch (error) {
    if (error instanceof GameError && error.code === "SECTOR_OCCUPIED") {
      res.status(409).json({ error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }
}
