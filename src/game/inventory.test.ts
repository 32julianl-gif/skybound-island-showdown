import { describe, expect, it } from "vitest";
import { quickEquip, transferStack } from "./inventory";
import type { Slot } from "./items";

describe("Shift-click inventory rules", () => {
  it("moves a chest stack into inventory, merging existing stacks first", () => {
    const chest: Slot[] = [{ id: "arrow", n: 20 }];
    const inventory: Slot[] = [{ id: "arrow", n: 60 }, null];
    expect(transferStack(chest, 0, inventory)).toBe(true);
    expect(chest[0]).toBeNull();
    expect(inventory).toEqual([{ id: "arrow", n: 64 }, { id: "arrow", n: 16 }]);
  });
  it("keeps leftovers in the chest when inventory has limited space", () => {
    const chest: Slot[] = [{ id: "arrow", n: 20 }];
    const inventory: Slot[] = [{ id: "arrow", n: 60 }];
    transferStack(chest, 0, inventory);
    expect(chest[0]).toEqual({ id: "arrow", n: 16 });
    expect(inventory[0]?.n).toBe(64);
    expect(transferStack(chest, 0, inventory)).toBe(false);
    expect(chest[0]?.n).toBe(16);
  });
  it("equips Shift-clicked armor into its matching part and preserves worn armor", () => {
    const chest: Slot[] = [{ id: "iron_chestplate", n: 1 }];
    const armor: Slot[] = [null, { id: "leather_chestplate", n: 1 }, null, null];
    expect(quickEquip(chest, 0, armor)).toBe(true);
    expect(armor[1]).toEqual({ id: "iron_chestplate", n: 1 });
    expect(chest[0]).toEqual({ id: "leather_chestplate", n: 1 });
  });
  it("equips all four armor types from inventory but rejects weapons", () => {
    const inventory: Slot[] = ["helmet", "chestplate", "leggings", "boots"].map(part => ({ id: `diamond_${part}`, n: 1 }));
    inventory.push({ id: "wood_sword", n: 1 });
    const armor: Slot[] = [null, null, null, null];
    for (let i = 0; i < 4; i++) expect(quickEquip(inventory, i, armor)).toBe(true);
    expect(armor.map(item => item?.id)).toEqual(["diamond_helmet", "diamond_chestplate", "diamond_leggings", "diamond_boots"]);
    expect(inventory.slice(0, 4)).toEqual([null, null, null, null]);
    expect(quickEquip(inventory, 4, armor)).toBe(false);
    expect(inventory[4]?.id).toBe("wood_sword");
  });
});