import { RULES } from "./rules.js";

/** Absolute dollar take band for NPC heists at this attacker reputation (L10+). */
export function npcPayoutBand(attackerLevel: number): { min: number; max: number } | null {
  const L = Math.max(1, Math.floor(attackerLevel));
  for (const band of RULES.NPC_PAYOUT_BANDS) {
    if (L >= band.from && L < band.to) return { min: band.min, max: band.max };
  }
  return null;
}

/**
 * Tier-split take window inside the reputation band.
 * Tier 0 (strongest) → high end; tier 4 → low end.
 */
export function npcTakeWindow(
  attackerLevel: number,
  tierIndex: number,
  diamondHard = false,
): { min: number; max: number } | null {
  const band = npcPayoutBand(attackerLevel);
  if (!band) return null;
  const tier = Math.max(0, Math.min(4, Math.floor(tierIndex)));
  const span = band.max - band.min;
  const slice = span / 5;
  const highBias = 4 - tier;
  let lo = Math.floor(band.min + highBias * slice * 0.55);
  let hi = Math.floor(band.min + slice * 1.9 + highBias * slice * 0.75);
  if (diamondHard) {
    lo = Math.min(band.max, Math.floor(lo * 1.08));
    hi = Math.min(band.max, Math.floor(hi * 1.1));
  }
  lo = Math.max(band.min, Math.min(lo, band.max));
  hi = Math.max(lo, Math.min(hi, band.max));
  return { min: lo, max: hi };
}
