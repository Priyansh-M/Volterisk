/**
 * Every gameplay number lives on this object. Services must not hardcode them.
 *
 * Effective combat level
 * ----------------------
 * effectiveLevel = (weaponNumber - 1) * 3 + upgradeLevel
 *
 * Upgrade level is an integer from WEAPON_MIN_UPGRADE (1) through
 * WEAPON_MAX_UPGRADE (4). Weapon N at upgrade 1 matches weapon N-1 at
 * upgrade 4, because (N-1)*3+1 === (N-2)*3+4.
 *
 *   Rusty Crowbar (1) upgrade 1 → 1
 *   Rusty Crowbar (1) upgrade 4 → 4
 *   Lockpick Set  (2) upgrade 1 → 4
 *   Vault Breaker (5) upgrade 4 → 16
 *
 * That effective level is the weaponLevel passed into the success formula
 * in probability.ts. Vault level is the integer on the target vault (1–10).
 */
export const RULES = {
  MIN_VAULT_BALANCE: 10_000,
  TARGET_PROTECTION_HOURS: 12,
  HEIST_COOLDOWN_HOURS: 2,
  /** Hard ceiling is 10. rewards.ts clamps to this and never pays more. */
  HEIST_REWARD_PERCENT: 10,
  STARTING_CASH: 40_000,
  STARTING_VAULT_BALANCE: 25_000,
  STARTING_VAULT_LEVEL: 1,
  VAULT_MIN_LEVEL: 1,
  VAULT_MAX_LEVEL: 10,
  WEAPON_MIN_UPGRADE: 1,
  WEAPON_MAX_UPGRADE: 4,
  /** Player level = 1 + floor(successfulHeists / this). */
  PLAYER_HEISTS_PER_LEVEL: 3,
  /** Vault balance >= this (and still under fortune) is "heavy". Below it, if heistable, is "modest". */
  WEALTH_HEAVY_AT: 100_000,
  WEALTH_FORTUNE_AT: 500_000,
  WEAPONS: [
    { id: "weapon:0001", number: 1, name: "Rusty Crowbar" },
    { id: "weapon:0002", number: 2, name: "Lockpick Set" },
    { id: "weapon:0003", number: 3, name: "Advanced Drill" },
    { id: "weapon:0004", number: 4, name: "Thermal Cutter" },
    { id: "weapon:0005", number: 5, name: "Vault Breaker" },
  ],
  /**
   * Cash to buy a weapon the player does not own yet.
   * weapon:0001 is issued at signup and is not sold.
   * Players may only buy the next number up from the best weapon they own.
   */
  WEAPON_BUY_COSTS: {
    "weapon:0001": 0,
    "weapon:0002": 20_000,
    "weapon:0003": 80_000,
    "weapon:0004": 220_000,
    "weapon:0005": 650_000,
  } as Record<string, number>,
  /**
   * Cash to raise a weapon FROM this upgrade level to the next.
   * Keys are the current upgrade level (1, 2, or 3). Level 4 is the cap.
   */
  WEAPON_UPGRADE_COSTS: {
    "weapon:0001": { 1: 4_000, 2: 9_000, 3: 18_000 },
    "weapon:0002": { 1: 12_000, 2: 28_000, 3: 55_000 },
    "weapon:0003": { 1: 30_000, 2: 70_000, 3: 140_000 },
    "weapon:0004": { 1: 80_000, 2: 180_000, 3: 360_000 },
    "weapon:0005": { 1: 200_000, 2: 450_000, 3: 900_000 },
  } as Record<string, Record<number, number>>,
  /**
   * Cash to raise a vault FROM this level to the next.
   * 1→2 $25,000, 2→3 $75,000, 3→4 $200,000, then the same steep climb through level 10.
   */
  VAULT_UPGRADE_COSTS: {
    1: 25_000,
    2: 75_000,
    3: 200_000,
    4: 500_000,
    5: 1_250_000,
    6: 3_000_000,
    7: 7_500_000,
    8: 18_000_000,
    9: 45_000_000,
  } as Record<number, number>,
};

export type WealthBucket = "modest" | "heavy" | "fortune";

export function effectiveWeaponLevel(weaponNumber: number, upgradeLevel: number): number {
  return (weaponNumber - 1) * 3 + upgradeLevel;
}

export function playerLevelFromHeists(successfulHeists: number): number {
  if (successfulHeists < 0) return 1;
  return 1 + Math.floor(successfulHeists / RULES.PLAYER_HEISTS_PER_LEVEL);
}

export function wealthBucket(balance: number): WealthBucket {
  if (balance >= RULES.WEALTH_FORTUNE_AT) return "fortune";
  if (balance >= RULES.WEALTH_HEAVY_AT) return "heavy";
  return "modest";
}

export function weaponById(id: string) {
  return RULES.WEAPONS.find((weapon) => weapon.id === id) ?? null;
}

export function hoursFromNow(hours: number, from = new Date()): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function hoursAgo(hours: number, from = new Date()): Date {
  return new Date(from.getTime() - hours * 60 * 60 * 1000);
}
