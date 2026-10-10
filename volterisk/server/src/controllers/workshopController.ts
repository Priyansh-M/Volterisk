import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import { syncAchievements } from "../services/achievementService.js";
import { listMaterials } from "../services/materialService.js";
import {
  cancelCraft,
  collectCraft,
  getWorkshop,
  startCraft,
  upgradeWorkshop,
} from "../services/workshopService.js";
import {
  buyListing,
  cancelListing,
  createListing,
  listBlackMarket,
} from "../services/blackMarketService.js";

export async function materials(req: Request, res: Response): Promise<void> {
  res.json(await listMaterials(currentUserId(req)));
}

export async function workshop(req: Request, res: Response): Promise<void> {
  res.json(await getWorkshop(currentUserId(req)));
}

export async function workshopUpgrade(req: Request, res: Response): Promise<void> {
  res.json(await upgradeWorkshop(currentUserId(req)));
}

export async function craftStart(req: Request, res: Response): Promise<void> {
  const recipeId = String((req.body as { recipeId?: string })?.recipeId ?? "");
  res.status(201).json(await startCraft(currentUserId(req), recipeId));
}

export async function craftCancel(req: Request, res: Response): Promise<void> {
  const jobId = String((req.body as { jobId?: string })?.jobId ?? "");
  res.json(await cancelCraft(currentUserId(req), jobId));
}

export async function craftCollect(req: Request, res: Response): Promise<void> {
  const jobId = String((req.body as { jobId?: string })?.jobId ?? "");
  const userId = currentUserId(req);
  const collected = await collectCraft(userId, jobId);
  const unlocked = await syncAchievements(userId);
  res.json({ ...collected, unlocked });
}

export async function blackMarket(req: Request, res: Response): Promise<void> {
  res.json(await listBlackMarket(currentUserId(req)));
}

export async function blackMarketList(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    kind?: "material" | "weapon" | "mod";
    itemId?: string;
    quantity?: number;
    price?: number;
    userWeaponId?: string;
    modOwnedId?: string;
  };
  res.status(201).json(
    await createListing(currentUserId(req), {
      kind: body.kind ?? "material",
      itemId: body.itemId,
      quantity: body.quantity,
      price: Number(body.price ?? 0),
      userWeaponId: body.userWeaponId,
      modOwnedId: body.modOwnedId,
    }),
  );
}

export async function blackMarketCancel(req: Request, res: Response): Promise<void> {
  const listingId = String((req.body as { listingId?: string })?.listingId ?? "");
  res.json(await cancelListing(currentUserId(req), listingId));
}

export async function blackMarketBuy(req: Request, res: Response): Promise<void> {
  const listingId = String((req.body as { listingId?: string })?.listingId ?? "");
  res.json(await buyListing(currentUserId(req), listingId));
}
