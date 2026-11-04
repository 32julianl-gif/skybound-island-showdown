import { describe, expect, it } from "vitest";
import { swordAppearance, SWORD_PIXELS, SWORD_TIERS } from "./sword-appearance";

describe("distinct sword tiers", () => {
  it("maps all four swords to different pixel silhouettes", () => {
    expect(SWORD_TIERS.map((tier) => swordAppearance(`${tier}_sword`))).toEqual(["wood", "stone", "iron", "diamond"]);
    expect(new Set(SWORD_TIERS.map((tier) => SWORD_PIXELS[tier].join("\n"))).size).toBe(4);
    for (const tier of SWORD_TIERS) expect(SWORD_PIXELS[tier].some((row) => row.includes("b"))).toBe(true);
    expect(swordAppearance("bow")).toBe(null);
    expect(swordAppearance(null)).toBe(null);
  });
});