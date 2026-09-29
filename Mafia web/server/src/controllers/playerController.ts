import type { Request, Response } from "express";
import { GameError } from "../game/errors.js";
import { publicDossier } from "../services/publicProfileService.js";

export async function publicPlayer(req: Request, res: Response): Promise<void> {
  const username = req.params.username;
  if (!username || username.length > 24) {
    throw new GameError(400, "VALIDATION", "That username is not valid.");
  }
  const dossier = await publicDossier(username);
  if (!dossier) throw new GameError(404, "NOT_FOUND", "No such player.");
  res.json(dossier);
}
