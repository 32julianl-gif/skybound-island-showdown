import { expect, it } from "vitest";
import { armorAppearance } from "./armor-appearance";
it("identifies the distinct material tier of all four armor parts", () => {
  for (const tier of ["leather", "iron", "diamond"]) {
    for (const part of ["helmet", "chestplate", "leggings", "boots"]) {
      expect(armorAppearance(`${tier}_${part}`)).toEqual({ tier, part });
    }
  }
  expect(armorAppearance("diamond_sword")).toBeNull();
  expect(armorAppearance(null)).toBeNull();
});