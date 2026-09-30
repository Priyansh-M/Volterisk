import { describe, expect, it } from "vitest";
import { successChance } from "../src/game/probability.js";
import { RULES, attackPower, maxDurability, vaultDefense } from "../src/game/rules.js";

describe("success chance", () => {
  it("matches attack versus defense", () => {
    expect(successChance(10, 10)).toBe(55);
    expect(successChance(13, 10)).toBe(61);
    expect(successChance(10, 15)).toBe(45);
    expect(successChance(19, 10)).toBe(73);
  });

  it("subtracts camera level before the clamp", () => {
    expect(successChance(10, 10, 3)).toBe(52);
    expect(successChance(10, 10, 100)).toBe(8);
  });

  it("clamps a large gap", () => {
    expect(successChance(10, 200)).toBe(8);
    expect(successChance(200, 10)).toBe(92);
  });
});

describe("attack power", () => {
  it("uses the fifteen-weapon table and sits just under the next tool", () => {
    expect(RULES.WEAPONS).toHaveLength(15);
    expect(RULES.WEAPONS.map((weapon) => weapon.name)).toEqual([
      "Rusty Crowbar",
      "Glasswire Saw",
      "Pressure Spike",
      "Lockpick Set",
      "Ceramic Lance",
      "Pulse Ram",
      "Advanced Drill",
      "Magnetic Shear",
      "Resonance Driver",
      "Thermal Cutter",
      "Induction Wedge",
      "Arc Fracture Unit",
      "Vault Breaker",
      "Graviton Press",
      "Seismic Lance",
    ]);
    for (const weapon of RULES.WEAPONS) {
      expect(weapon.attacks).toHaveLength(4);
      expect(attackPower(weapon.number, 1)).toBe(weapon.attacks[0]);
      expect(attackPower(weapon.number, 4)).toBe(weapon.attacks[3]);
      const next = RULES.WEAPONS.find((entry) => entry.number === weapon.number + 1);
      if (next) expect(weapon.attacks[3] + 1).toBe(next.attacks[0]);
      expect(RULES.WEAPON_BUY_COSTS[weapon.id]).toBeGreaterThanOrEqual(0);
      for (const level of [1, 2, 3] as const) {
        expect(RULES.WEAPON_UPGRADE_COSTS[weapon.id][level]).toBeGreaterThan(0);
      }
    }
    expect(attackPower(1, 1)).toBe(10);
    expect(attackPower(1, 4)).toBe(19);
    expect(attackPower(4, 1)).toBe(36);
    expect(attackPower(15, 4)).toBe(190);
    expect(maxDurability("weapon:0001", 1)).toBe(50);
    expect(maxDurability("weapon:0001", 4)).toBe(65);
    expect(maxDurability("weapon:0004", 1)).toBe(20);
    expect(maxDurability("weapon:0013", 4)).toBe(30);
    expect(maxDurability("weapon:0015", 1)).toBe(16);
    expect(RULES.WEAPON_BUY_COSTS["weapon:0002"]).toBe(5_000);
    expect(RULES.WEAPON_BUY_COSTS["weapon:0015"]).toBe(750_000);
    expect(vaultDefense("standard", 1)).toBe(10);
    expect(vaultDefense("silver", 1)).toBe(32);
    expect(vaultDefense("diamond", 5)).toBe(165);
  });
});
