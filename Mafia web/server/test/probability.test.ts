import { describe, expect, it } from "vitest";
import { successChance } from "../src/game/probability.js";
import { attackPower, vaultDefense } from "../src/game/rules.js";

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
  it("overlaps the next weapon's first level", () => {
    expect(attackPower(1, 4)).toBe(attackPower(2, 1));
    expect(attackPower(2, 4)).toBe(attackPower(3, 1));
    expect(attackPower(3, 4)).toBe(attackPower(4, 1));
    expect(attackPower(4, 4)).toBe(attackPower(5, 1));
    expect(attackPower(1, 1)).toBe(10);
    expect(attackPower(5, 4)).toBe(88);
    expect(vaultDefense("standard", 1)).toBe(10);
    expect(vaultDefense("silver", 1)).toBe(32);
    expect(vaultDefense("diamond", 5)).toBe(165);
  });
});
