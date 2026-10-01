import type { Request, Response } from "express";
import { z } from "zod";
import { currentUserId } from "../middleware/auth.js";
import { loginPlayer, logoutPlayer, registerPlayer, usernameAvailable } from "../services/userService.js";

const credentialsSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Name needs 3 to 24 characters.")
      .max(24, "Name needs 3 to 24 characters.")
      .regex(/^[A-Za-z0-9][A-Za-z0-9 .'_-]*$/, "Use letters, numbers, spaces, apostrophes, hyphens, or underscores."),
    password: z.string().min(8, "Password needs eight characters.").max(72, "Password can be at most 72 characters."),
  })
  .strict();

export async function nameStatus(req: Request, res: Response): Promise<void> {
  const username = z.string().max(24).parse(typeof req.query.username === "string" ? req.query.username : "");
  res.json(await usernameAvailable(username));
}

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
