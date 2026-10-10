import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { getCareer, setPrimaryCareer, setSecondaryCareer } from "../services/careerService.js";

export async function career(req: Request, res: Response): Promise<void> {
  res.json(await getCareer(currentUserId(req)));
}

export async function setPrimary(req: Request, res: Response): Promise<void> {
  const careerId = String((req.body as { careerId?: string })?.careerId ?? "");
  res.json(await setPrimaryCareer(currentUserId(req), careerId));
}

export async function setSecondary(req: Request, res: Response): Promise<void> {
  const raw = (req.body as { careerId?: string | null })?.careerId;
  const careerId = raw === null || raw === undefined || raw === "" ? null : String(raw);
  res.json(await setSecondaryCareer(currentUserId(req), careerId));
}
