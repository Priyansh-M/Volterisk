import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import {
  cancelBounty,
  claimBounty,
  clearBountyCache,
  createBounty,
  fundBounty,
  listBounties,
  searchBountyTargets,
  startBounty,
} from "../services/bountyService.js";

async function changed<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } finally {
    clearBountyCache();
  }
}

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
  res.status(201).json(await changed(createBounty(currentUserId(req), targetUserId, amount, durationHours)));
}

export async function fund(req: Request, res: Response): Promise<void> {
  res.json(await changed(fundBounty(currentUserId(req), String(req.params.id), Number(req.body?.amount))));
}

export async function start(req: Request, res: Response): Promise<void> {
  res.json(await changed(startBounty(currentUserId(req), String(req.params.id))));
}

export async function claim(req: Request, res: Response): Promise<void> {
  res.json(await changed(claimBounty(currentUserId(req), String(req.params.id))));
}

export async function cancel(req: Request, res: Response): Promise<void> {
  res.json(await changed(cancelBounty(currentUserId(req), String(req.params.id))));
}
