import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { listWeapons } from "../services/weaponService.js";
import { getProfile, setAvatar } from "../services/userService.js";
import { getVault } from "../services/vaultService.js";

export async function me(req: Request, res: Response): Promise<void> {
  res.json(await getProfile(currentUserId(req)));
}

export async function myVault(req: Request, res: Response): Promise<void> {
  res.json(await getVault(currentUserId(req)));
}

export async function myWeapons(req: Request, res: Response): Promise<void> {
  res.json(await listWeapons(currentUserId(req)));
}

export async function updateAvatar(req: Request, res: Response): Promise<void> {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  res.json(await setAvatar(currentUserId(req), url));
}
