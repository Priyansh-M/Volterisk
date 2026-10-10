import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
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
  res.json(await advanceExpansion(currentUserId(req)));
}

export async function abandon(req: Request, res: Response): Promise<void> {
  res.json(await abandonExpansion(currentUserId(req)));
}

export async function specialize(req: Request, res: Response): Promise<void> {
  const body = req.body as { holdingId?: string; specialization?: string | null };
  res.json(
    await setSpecialization(currentUserId(req), String(body.holdingId ?? ""), body.specialization ?? null),
  );
}

export async function recolor(req: Request, res: Response): Promise<void> {
  const body = req.body as { holdingId?: string; colorId?: string; instanceId?: string };
  res.json(
    await applyTerritoryColor(
      currentUserId(req),
      String(body.holdingId ?? ""),
      String(body.colorId ?? ""),
      body.instanceId ? String(body.instanceId) : undefined,
    ),
  );
}
