import { randomBytes } from "node:crypto";
import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { createPlayer, ensureWeaponCatalog } from "./userService.js";

/**
 * Seeded night-crew ledgers. Vault balances sit at or above MIN_VAULT_BALANCE
 * so the vulnerability rule can keep them on the NPC board.
 */
export const NIGHT_CREW = [
  { username: "Mara Voss", cash: 12_000, vaultBalance: 18_000, vaultLevel: 1 },
  { username: "Eddie Quill", cash: 8_000, vaultBalance: 42_000, vaultLevel: 1 },
  { username: "Nia Pell", cash: 22_000, vaultBalance: 96_000, vaultLevel: 2 },
  { username: "Hugo Brandt", cash: 15_000, vaultBalance: 80_000, vaultLevel: 4 },
  { username: "Colette Marsh", cash: 40_000, vaultBalance: 240_000, vaultLevel: 3 },
  { username: "Felix Dunn", cash: 90_000, vaultBalance: 880_000, vaultLevel: 6 },
  { username: "Ruth Keene", cash: 6_000, vaultBalance: 55_000, vaultLevel: 2 },
  { username: "Samir Odeh", cash: 120_000, vaultBalance: 1_500_000, vaultLevel: 8 },
  { username: "Inez Calder", cash: 3_000, vaultBalance: 12_000, vaultLevel: 1 },
  { username: "Paulie Tran", cash: 18_000, vaultBalance: 300_000, vaultLevel: 5 },
] as const;

export type NightCrewMember = (typeof NIGHT_CREW)[number];

/** Seed balance, lifted to the heist floor only when the roster itself is too thin. */
export function heistableVaultBalance(balance: number): number {
  return balance >= RULES.MIN_VAULT_BALANCE ? balance : RULES.MIN_VAULT_BALANCE;
}

/**
 * Inserts any missing night-crew bots. Existing rows keep their cash and vault
 * so a restart does not undo a completed heist. A name already on the ledger
 * is marked as a bot so it stays on the NPC board and off the leaderboard.
 */
export async function ensureNightCrew(): Promise<void> {
  await ensureWeaponCatalog();
  for (const bot of NIGHT_CREW) {
    const usernameKey = bot.username.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { usernameKey } });
    if (existing) {
      if (!existing.isBot) {
        await prisma.user.update({ where: { id: existing.id }, data: { isBot: true } });
      }
      continue;
    }
    await createPlayer({
      username: bot.username,
      password: randomBytes(24).toString("hex"),
      isBot: true,
      cash: bot.cash,
      vaultBalance: heistableVaultBalance(bot.vaultBalance),
      vaultLevel: bot.vaultLevel,
    });
  }
}
