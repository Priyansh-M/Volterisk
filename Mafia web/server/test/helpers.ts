import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

export const app = createApp();

let seq = 0;

export async function registerUser(name?: string) {
  seq += 1;
  const username = name ?? `Runner ${seq} ${Date.now().toString().slice(-5)}`;
  const password = "nightshift";
  const res = await request(app).post("/api/auth/register").send({ username, password });
  if (res.status !== 201) {
    throw new Error(`register failed ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.token as string,
    id: res.body.user.id as string,
    username: res.body.user.username as string,
    cash: res.body.user.cash as number,
    vaultBalance: res.body.user.vault.balance as number,
  };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function books() {
  const users = await prisma.user.findMany({ include: { vault: true } });
  let cash = 0;
  let vault = 0;
  for (const user of users) {
    if (user.cash < 0 || (user.vault?.balance ?? 0) < 0) {
      throw new Error(`negative balance for ${user.username}`);
    }
    cash += user.cash;
    vault += user.vault?.balance ?? 0;
  }
  return { cash, vault, total: cash + vault, users };
}

export async function userState(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { vault: true } });
  if (!user?.vault) throw new Error("missing user");
  return { cash: user.cash, vault: user.vault.balance, level: user.vault.level };
}
