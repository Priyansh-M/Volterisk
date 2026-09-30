import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { loginPlayer, logoutPlayer, registerPlayer } from "../services/userService.js";

const credentialsSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 .'-]*$/, "Use letters, numbers, spaces, apostrophes, or hyphens."),
    password: z.string().min(8).max(72),
  })
  .strict();

export async function register(req: Request, res: Response): Promise<void> {
  const body = credentialsSchema.parse(req.body ?? {});
  const result = await registerPlayer(body.username, body.password);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = credentialsSchema.parse(req.body ?? {});
  const result = await loginPlayer(body.username, body.password);
  res.json(result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  await logoutPlayer(currentUserId(req));
  res.json({ ok: true });
}
