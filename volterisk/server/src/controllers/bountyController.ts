import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import {
  cancelBounty,
  claimBounty,
  createBounty,
  fundBounty,
  listBounties,
  searchBountyTargets,
  startBounty,
} from "../services/bountyService.js";

export async function board(req: Request, res: Response): Promise<void> {
  res.json(await listBounties(currentUserId(req)));
}

export async function search(req: Request, res: Response): Promise<void> {
  res.json({ players: await searchBountyTargets(currentUserId(req), String(req.query.q ?? "")) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const targetUserId = String(req.body?.targetUserId ?? "");
  const amount = Number(req.body?.amount);
  const durationHours = Number(req.body?.durationHours ?? 24);
  res.status(201).json(await createBounty(currentUserId(req), targetUserId, amount, durationHours));
}

export async function fund(req: Request, res: Response): Promise<void> {
  res.json(await fundBounty(currentUserId(req), String(req.params.id), Number(req.body?.amount)));
}

export async function start(req: Request, res: Response): Promise<void> {
  res.json(await startBounty(currentUserId(req), String(req.params.id)));
}

export async function claim(req: Request, res: Response): Promise<void> {
  res.json(await claimBounty(currentUserId(req), String(req.params.id)));
}

export async function cancel(req: Request, res: Response): Promise<void> {
  res.json(await cancelBounty(currentUserId(req), String(req.params.id)));
}
