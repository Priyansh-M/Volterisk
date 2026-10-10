import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { syncAchievements } from "../services/achievementService.js";
import {
  activateLockdown,
  buyMod,
  installVaultMod,
  installWeaponMod,
  listMods,
  removeVaultMod,
  removeWeaponMod,
} from "../services/modService.js";

export async function mods(req: Request, res: Response): Promise<void> {
  res.json(await listMods(currentUserId(req)));
}

export async function purchaseMod(req: Request, res: Response): Promise<void> {
  const modId = String((req.body as { modId?: string })?.modId ?? "");
  res.status(201).json(await buyMod(currentUserId(req), modId));
}

export async function installWeapon(req: Request, res: Response): Promise<void> {
  const body = req.body as { instanceId?: string; userWeaponId?: string };
  const userId = currentUserId(req);
  const installed = await installWeaponMod(userId, String(body.instanceId ?? ""), String(body.userWeaponId ?? ""));
  const unlocked = await syncAchievements(userId);
  res.json({ ...installed, unlocked });
}

export async function uninstallWeapon(req: Request, res: Response): Promise<void> {
  const instanceId = String((req.body as { instanceId?: string })?.instanceId ?? "");
  res.json(await removeWeaponMod(currentUserId(req), instanceId));
}

export async function installVault(req: Request, res: Response): Promise<void> {
  const instanceId = String((req.body as { instanceId?: string })?.instanceId ?? "");
  const userId = currentUserId(req);
  const installed = await installVaultMod(userId, instanceId);
  const unlocked = await syncAchievements(userId);
  res.json({ ...installed, unlocked });
}

export async function uninstallVault(req: Request, res: Response): Promise<void> {
  const instanceId = String((req.body as { instanceId?: string })?.instanceId ?? "");
  res.json(await removeVaultMod(currentUserId(req), instanceId));
}

export async function armLockdown(req: Request, res: Response): Promise<void> {
  res.json(await activateLockdown(currentUserId(req)));
}
