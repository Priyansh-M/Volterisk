import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { attemptHeist, consumeEstimate, heistHistory, listTargets, quoteHeist } from "../services/heistService.js";

const kindSchema = z.enum(["npc", "player"]);

const heistBodySchema = z
  .object({
    targetUserId: z.string().min(1).max(64),
    weaponId: z.string().regex(/^weapon:\d{4}$/),
    kind: kindSchema.optional(),
    instanceId: z.string().min(1).max(40).optional(),
  })
  .strict();

export async function targets(req: Request, res: Response): Promise<void> {
  res.json(await listTargets(currentUserId(req)));
}

const estimateSchema = z
  .object({
    targetUserId: z.string().min(1).max(64),
    weaponId: z.string().regex(/^weapon:\d{4}$/),
    kind: kindSchema.optional(),
  })
  .strict();

export async function estimate(req: Request, res: Response): Promise<void> {
  const body = estimateSchema.parse(req.body ?? {});
  res.json(
    await consumeEstimate(currentUserId(req), body.targetUserId, body.weaponId, body.kind ?? "player"),
  );
}

export async function quote(req: Request, res: Response): Promise<void> {
  const body = heistBodySchema.parse(req.body ?? {});
  res.json(
    await quoteHeist(currentUserId(req), body.targetUserId, body.weaponId, body.kind ?? "player"),
  );
}

export async function createHeist(req: Request, res: Response): Promise<void> {
  const body = heistBodySchema.parse(req.body ?? {});
  const heist = await attemptHeist(
    currentUserId(req),
    body.targetUserId,
    body.weaponId,
    body.kind ?? "player",
    body.instanceId,
  );
  res.status(201).json(heist);
}

export async function history(req: Request, res: Response): Promise<void> {
  res.json({ heists: await heistHistory(currentUserId(req)) });
}
