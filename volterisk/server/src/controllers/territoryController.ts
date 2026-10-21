import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { syncAchievements } from "../services/achievementService.js";
import { clearMapCache } from "../services/baseService.js";
import {
  abandonExpansion,
  advanceExpansion,
  applyTerritoryColor,
  getTerritoryBoard,
  setSpecialization,
  startScout,
} from "../services/territoryService.js";

export async function board(req: Request, res: Response): Promise<void> {
  res.json(await getTerritoryBoard(currentUserId(req)));
}

export async function scout(req: Request, res: Response): Promise<void> {
  const body = req.body as { sectorId?: string; landmassId?: string; regionName?: string };
  res.json(
    await startScout(currentUserId(req), {
      sectorId: body.sectorId ?? "",
      landmassId: body.landmassId ?? "",
      regionName: body.regionName ?? "",
    }),
  );
}

export async function advance(req: Request, res: Response): Promise<void> {
  const userId = currentUserId(req);
  const board = await advanceExpansion(userId);
  clearMapCache();
  const unlocked = await syncAchievements(userId).catch(() => []);
  res.json({ ...board, unlocked });
}

export async function abandon(req: Request, res: Response): Promise<void> {
  const out = await abandonExpansion(currentUserId(req));
  clearMapCache();
  res.json(out);
}

export async function specialize(req: Request, res: Response): Promise<void> {
  const body = req.body as { holdingId?: string; specialization?: string | null };
  const out = await setSpecialization(currentUserId(req), String(body.holdingId ?? ""), body.specialization ?? null);
  clearMapCache();
  res.json(out);
}

export async function recolor(req: Request, res: Response): Promise<void> {
  const body = req.body as { holdingId?: string; colorId?: string; instanceId?: string };
  const out = await applyTerritoryColor(
    currentUserId(req),
    String(body.holdingId ?? ""),
    String(body.colorId ?? ""),
    body.instanceId ? String(body.instanceId) : undefined,
  );
  clearMapCache();
  res.json(out);
}
