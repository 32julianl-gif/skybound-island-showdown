import { describe, expect, it } from "vitest";
import { arrowDamage, healthAfterHit, HIT_LIFT, knockbackAfterArmor, MAX_HEALTH, meleeDamage } from "./combat";
import type { Slot } from "./items";

const diamond: Slot[] = ["helmet", "chestplate", "leggings", "boots"].map((part) => ({ id: `diamond_${part}`, n: 1 }));

describe("PvP rules", () => {
  it("halves original horizontal and vertical knockback", () => {
    expect(knockbackAfterArmor(10, [])).toBe(5);
    expect(knockbackAfterArmor(17, [])).toBe(8.5);
    expect(HIT_LIFT).toBe(3.25);
    expect(knockbackAfterArmor(10, diamond)).toBe(2);
  });
  it("armor reduces incoming damage", () => {
    expect(healthAfterHit(20, 5, [])).toBe(15);
    expect(healthAfterHit(20, 5, diamond)).toBe(18);
    expect(healthAfterHit(20, 5, [{ id: "iron_chestplate", n: 1 }])).toBeCloseTo(15.9);
  });
  it("health reaches zero when lethal damage lands", () => {
    expect(MAX_HEALTH).toBe(20);
    expect(healthAfterHit(3, 4, [])).toBe(0);
  });
  it("swords and arrows deal health damage", () => {
    expect(meleeDamage("wood_sword")).toBe(4);
    expect(meleeDamage("diamond_sword")).toBe(7);
    expect(meleeDamage("b6")).toBe(1);
    expect(arrowDamage(34)).toBe(8);
  });
});