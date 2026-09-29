import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { syncAchievements } from "../services/achievementService.js";
import { acceptContract, collectContract, listContracts, listPassiveJobs, selectPassiveJob } from "../services/workService.js";

const acceptSchema = z
  .object({
    contractId: z.string().trim().min(1).max(64),
  })
  .strict();

const emptySchema = z.object({}).strict();

export async function contracts(req: Request, res: Response): Promise<void> {
  res.json(await listContracts(currentUserId(req)));
}

export async function accept(req: Request, res: Response): Promise<void> {
  const body = acceptSchema.parse(req.body ?? {});
  res.status(201).json(await acceptContract(currentUserId(req), body.contractId));
}

export async function collect(req: Request, res: Response): Promise<void> {
  emptySchema.parse(req.body ?? {});
  const userId = currentUserId(req);
  const paid = await collectContract(userId);
  const unlocked = await syncAchievements(userId);
  res.json({ ...paid, unlocked });
}

export async function passive(req: Request, res: Response): Promise<void> {
  res.json(await listPassiveJobs(currentUserId(req)));
}

export async function collectPassivePay(req: Request, res: Response): Promise<void> {
  const body = z.object({ jobId: z.string().trim().min(1).max(64) }).strict().parse(req.body ?? {});
  res.json(await selectPassiveJob(currentUserId(req), body.jobId));
}
