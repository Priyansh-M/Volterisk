import { describe, expect, it } from "vitest";
import { successChance } from "../src/game/probability.js";
import { effectiveWeaponLevel } from "../src/game/rules.js";

describe("success chance", () => {
  it("matches the worked examples", () => {
    expect(successChance(1, 1)).toBe(60);
    expect(successChance(2, 1)).toBe(68);
    expect(successChance(1, 2)).toBe(52);
    expect(successChance(1, 4)).toBe(36);
  });

  it("handles weapon above, equal to, and below the vault", () => {
    expect(successChance(5, 2)).toBe(84);
    expect(successChance(4, 4)).toBe(60);
    expect(successChance(2, 6)).toBe(28);
  });

  it("clamps a large gap at 10 and 95", () => {
    expect(successChance(1, 30)).toBe(10);
    expect(successChance(40, 1)).toBe(95);
    expect(successChance(1, 8)).toBe(10);
    expect(successChance(6, 1)).toBe(95);
  });
});

describe("effective weapon level", () => {
  it("treats weapon N at upgrade 1 as weapon N-1 at upgrade 4", () => {
    for (let number = 2; number <= 5; number += 1) {
      expect(effectiveWeaponLevel(number, 1)).toBe(effectiveWeaponLevel(number - 1, 4));
    }
    expect(effectiveWeaponLevel(1, 1)).toBe(1);
    expect(effectiveWeaponLevel(5, 4)).toBe(16);
  });
});
