import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { attemptHeist, heistHistory, listTargets, previewHeist } from "../services/heistService.js";

const kindSchema = z.enum(["npc", "player"]);

const heistBodySchema = z
  .object({
    targetUserId: z.string().min(1).max(64),
    weaponId: z.string().regex(/^weapon:\d{4}$/),
    kind: kindSchema.optional(),
  })
  .strict();

const previewQuerySchema = z.object({
  targetUserId: z.string().min(1).max(64),
  weaponId: z.string().regex(/^weapon:\d{4}$/),
  kind: kindSchema.optional(),
});

export async function targets(req: Request, res: Response): Promise<void> {
  res.json(await listTargets(currentUserId(req)));
}

export async function preview(req: Request, res: Response): Promise<void> {
  const query = previewQuerySchema.parse(req.query);
  res.json(
    await previewHeist(currentUserId(req), query.targetUserId, query.weaponId, query.kind ?? "player"),
  );
}

export async function createHeist(req: Request, res: Response): Promise<void> {
  const body = heistBodySchema.parse(req.body ?? {});
  const heist = await attemptHeist(
    currentUserId(req),
    body.targetUserId,
    body.weaponId,
    body.kind ?? "player",
  );
  res.status(201).json(heist);
}

export async function history(req: Request, res: Response): Promise<void> {
  res.json({ heists: await heistHistory(currentUserId(req)) });
}
