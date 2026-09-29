/**
 * The only success formula in the game.
 *
 *   levelDifference = weaponLevel - vaultLevel
 *   successChance = 60 + (levelDifference * 8)
 *   clamp to [10, 95]
 *
 * weaponLevel is the effective combat level from rules.ts.
 * Worked examples: W1/V1 = 60, W2/V1 = 68, W1/V2 = 52, W1/V4 = 36.
 * The step is 8 because those four examples only hold at 8 points per level.
 */
const BASE_CHANCE = 60;
const CHANCE_PER_LEVEL = 8;
const MIN_CHANCE = 10;
const MAX_CHANCE = 95;

export function successChance(weaponLevel: number, vaultLevel: number): number {
  const levelDifference = weaponLevel - vaultLevel;
  const raw = BASE_CHANCE + levelDifference * CHANCE_PER_LEVEL;
  if (raw < MIN_CHANCE) return MIN_CHANCE;
  if (raw > MAX_CHANCE) return MAX_CHANCE;
  return raw;
}
