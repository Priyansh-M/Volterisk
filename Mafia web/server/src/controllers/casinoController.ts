import type { Request, Response } from "express";
import { currentUserId } from "../middleware/auth.js";
import {
  acceptInvite,
  createLobby,
  invitePlayer,
  layBets,
  leaveLobby,
  readLobby,
  rouletteStatus,
  searchPlayers,
  spinRoulette,
  spinTable,
} from "../services/casinoService.js";

export async function table(req: Request, res: Response): Promise<void> {
  res.json(await rouletteStatus(currentUserId(req)));
}

export async function spin(req: Request, res: Response): Promise<void> {
  const bets = Array.isArray(req.body?.bets) ? req.body.bets : [];
  res.json(await spinRoulette(currentUserId(req), bets));
}

export async function openLobby(req: Request, res: Response): Promise<void> {
  res.status(201).json(await createLobby(currentUserId(req)));
}

export async function lobby(req: Request, res: Response): Promise<void> {
  res.json(await readLobby(currentUserId(req), String(req.params.id)));
}

export async function players(req: Request, res: Response): Promise<void> {
  res.json({ players: await searchPlayers(currentUserId(req), String(req.query.q ?? "")) });
}

export async function invite(req: Request, res: Response): Promise<void> {
  res.json(await invitePlayer(currentUserId(req), String(req.params.id), String(req.body?.userId ?? "")));
}

export async function join(req: Request, res: Response): Promise<void> {
  res.json(await acceptInvite(currentUserId(req), String(req.params.id)));
}

export async function bets(req: Request, res: Response): Promise<void> {
  res.json(await layBets(currentUserId(req), String(req.params.id), Array.isArray(req.body?.bets) ? req.body.bets : []));
}

export async function tableSpin(req: Request, res: Response): Promise<void> {
  res.json(await spinTable(currentUserId(req), String(req.params.id)));
}

export async function exitLobby(req: Request, res: Response): Promise<void> {
  res.json(await leaveLobby(currentUserId(req), String(req.params.id)));
}
