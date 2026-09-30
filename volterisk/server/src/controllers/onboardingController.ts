import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { claimStarter } from "../services/onboardingService.js";

const emptySchema = z.object({}).strict();

export async function claim(req: Request, res: Response): Promise<void> {
  emptySchema.parse(req.body ?? {});
  res.json(await claimStarter(currentUserId(req)));
}
