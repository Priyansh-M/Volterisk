import { GameError } from "./errors.js";
import { RULES } from "./rules.js";

/** Absolute ceiling. Raising HEIST_REWARD_PERCENT above this still pays 10. */
const HARD_MAX_REWARD_PERCENT = 10;

/**
 * Cash taken from a vault on a successful heist.
 * floor(balance * percent / 100), percent hard-capped at 10.
 */
export function heistStealAmount(
  vaultBalance: number,
  rewardPercent: number = RULES.HEIST_REWARD_PERCENT,
): number {
  if (!Number.isInteger(vaultBalance) || vaultBalance < 0) {
    throw new GameError(400, "INVALID_AMOUNT", "Vault balance must be a non-negative integer.");
  }
  if (!Number.isInteger(rewardPercent) || rewardPercent < 0) {
    throw new GameError(400, "INVALID_AMOUNT", "Reward percent must be a non-negative integer.");
  }
  const percent = Math.min(rewardPercent, RULES.HEIST_REWARD_PERCENT, HARD_MAX_REWARD_PERCENT);
  return Math.floor((vaultBalance * percent) / 100);
}
