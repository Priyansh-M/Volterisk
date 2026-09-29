/**
 * Heist chance from attack versus vault defense.
 *
 *   advantage = attack - defense
 *   successChance = 55 + advantage * 2 - cameraLevel
 *   clamp to [8, 92]
 *
 * Camera level is subtracted before the clamp.
 * A matched crowbar and standard vault (10 vs 10) is 55%.
 * Each point of advantage is two points of chance.
 */
const BASE_CHANCE = 55;
const CHANCE_PER_POINT = 2;
const MIN_CHANCE = 8;
const MAX_CHANCE = 92;

export function successChance(attack: number, defense: number, cameraLevel = 0): number {
  const advantage = attack - defense;
  const reduction = Number.isFinite(cameraLevel) ? Math.max(0, cameraLevel) : 0;
  const raw = BASE_CHANCE + advantage * CHANCE_PER_POINT - reduction;
  if (raw < MIN_CHANCE) return MIN_CHANCE;
  if (raw > MAX_CHANCE) return MAX_CHANCE;
  return raw;
}
