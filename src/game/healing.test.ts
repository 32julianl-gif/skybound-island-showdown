import { describe, expect, it } from "vitest";
import { healedHealth, regenerationStep } from "./healing";
import { chestLoot, def } from "./items";

describe("natural healing", () => {
  it("restores exactly half a heart every five seconds", () => {
    expect(regenerationStep(10, 0, 4999)).toEqual({ health: 10, lastAt: 0 });
    expect(regenerationStep(10, 0, 5000)).toEqual({ health: 11, lastAt: 5000 });
    expect(regenerationStep(10, 0, 10000)).toEqual({ health: 12, lastAt: 10000 });
  });
  it("never exceeds twenty HP", () => {
    expect(regenerationStep(19.5, 0, 15000).health).toBe(20);
    expect(healedHealth(19, 6)).toBe(20);
  });
});

it("food heals and every chest provides deterministic food", () => {
  expect(healedHealth(10, def("apple").heal ?? 0)).toBe(14);
  expect(healedHealth(10, def("bread").heal ?? 0)).toBe(16);
  for (let round = 1; round <= 3; round++) {
    for (let chest = 0; chest < 16; chest++) {
      const loot = chestLoot(round, chest);
      expect(loot.some((item) => item && (def(item.id).heal ?? 0) > 0)).toBe(true);
      expect(loot).toEqual(chestLoot(round, chest));
    }
  }
});