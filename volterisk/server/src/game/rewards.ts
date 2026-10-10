import { randomInt } from "node:crypto";
import { GameError } from "./errors.js";
import { npcTakeWindow } from "./npcPayout.js";
import { RULES } from "./rules.js";

function assertVaultBalance(vaultBalance: number) {
  if (!Number.isInteger(vaultBalance) || vaultBalance < 0) {
    throw new GameError(400, "INVALID_AMOUNT", "Vault balance must be a non-negative integer.");
  }
}

function takePercent(vaultBalance: number, percent: number) {
  return Math.floor((vaultBalance * percent) / 100);
}

/**
 * Cash taken from a player vault on a successful heist.
 * Usually 1%–15% of the full vault. 4% of hits instead roll 35%–55%.
 * Pass `percent` / `jackpot` to force a band in tests.
 */
export function heistStealAmount(
  vaultBalance: number,
  opts?: { percent?: number; jackpot?: boolean },
): number {
  assertVaultBalance(vaultBalance);
  const jackpot =
    opts?.jackpot ?? randomInt(1, 101) <= RULES.PLAYER_STEAL_JACKPOT_CHANCE;
  const min = jackpot ? RULES.PLAYER_STEAL_JACKPOT_MIN : RULES.PLAYER_STEAL_PERCENT_MIN;
  const max = jackpot ? RULES.PLAYER_STEAL_JACKPOT_MAX : RULES.PLAYER_STEAL_PERCENT_MAX;
  const percent =
    opts?.percent != null && Number.isInteger(opts.percent)
      ? Math.min(max, Math.max(min, opts.percent))
      : randomInt(min, max + 1);
  return takePercent(vaultBalance, percent);
}

export type NpcStealOpts = {
  /** Force a percent (pre-L10 path / tests). */
  rewardPercent?: number;
  /** Attacker reputation — L10+ uses absolute dollar windows by tier. */
  attackerLevel?: number;
  tierIndex?: number;
  diamondHard?: boolean;
};

/**
 * Cash taken from an NPC purse.
 * Pre–reputation 10: 1%–15% of the purse.
 * Reputation 10+: dollar roll inside that crew’s tier window of the reputation band, capped by purse.
 */
export function heistStealAmountNpc(vaultBalance: number, opts?: NpcStealOpts | number): number {
  assertVaultBalance(vaultBalance);
  const normalized: NpcStealOpts =
    typeof opts === "number" ? { rewardPercent: opts } : (opts ?? {});

  const level = normalized.attackerLevel ?? 0;
  const window =
    level >= 10 && normalized.tierIndex != null
      ? npcTakeWindow(level, normalized.tierIndex, Boolean(normalized.diamondHard))
      : null;

  if (window) {
    const lo = Math.max(0, Math.min(window.min, vaultBalance));
    const hi = Math.max(lo, Math.min(window.max, vaultBalance));
    if (hi <= 0) return 0;
    if (lo >= hi) return lo;
    return randomInt(lo, hi + 1);
  }

  const min = RULES.NPC_STEAL_PERCENT_MIN;
  const max = RULES.NPC_STEAL_PERCENT_MAX;
  const percent =
    normalized.rewardPercent != null && Number.isInteger(normalized.rewardPercent)
      ? Math.min(max, Math.max(min, normalized.rewardPercent))
      : randomInt(min, max + 1);
  return takePercent(vaultBalance, percent);
}
