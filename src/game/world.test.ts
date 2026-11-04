import { describe, expect, it } from "vitest";
import { BLOCK, generateWorld, MAP_COUNT, mapDef } from "./world";

describe("reworked island arenas", () => {
  it("gives Classic Isles a giant editable tree with a towering leafy crown", () => {
    const world = generateWorld(0);
    expect(world.get(1, 18, 0)).toBe(BLOCK.LOG);
    expect(world.get(0, 25, 0)).toBe(BLOCK.LEAVES);
    expect(world.get(6, 17, 1)).toBe(BLOCK.LEAVES);
    expect(world.get(5, 1, 5)).toBe(BLOCK.LOG);
    expect(world.get(0, 2, 2)).toBe(0);
    world.set(1, 18, 0, 0);
    expect(world.get(1, 18, 0)).toBe(0);
  });

  it("gives Wide Sky roofless ruined central and satellite towers", () => {
    const world = generateWorld(1);
    expect(world.get(-7, 2, -4)).toBe(BLOCK.STONE);
    expect(world.get(-5, 2, -6)).toBe(0);
    expect(world.get(-5, 10, -4)).toBe(0);
    for (const tower of mapDef(1).mids) {
      expect(world.get(tower.x + 2, 2, tower.z)).toBe(BLOCK.STONE);
      expect(world.get(tower.x, 2, tower.z - 2)).toBe(0);
    }
  });

  for (const index of [0, 1]) {
    it(`keeps map ${index} spawns and every chest accessible and deterministic`, () => {
      const world = generateWorld(index);
      for (const p of [...mapDef(index).spawns, ...mapDef(index).chests]) {
        expect(world.get(p.x, 0, p.z)).not.toBe(0);
        expect(world.get(p.x, 1, p.z)).toBe(0);
        expect(world.get(p.x, 2, p.z)).toBe(0);
      }
      expect([...world.blocks]).toEqual([...generateWorld(index).blocks]);
    });
  }
});

describe("castle arena", () => {
  it("adds a large central castle to the existing map rotation", () => {
    expect(MAP_COUNT).toBe(4);
    const world = generateWorld(3);
    expect(mapDef(3).center).toBeGreaterThan(mapDef(0).center);
    expect(world.get(10, 4, 7)).toBe(BLOCK.STONE);
    expect(world.get(0, 13, -9)).toBe(BLOCK.PLANKS);
    expect(world.get(0, 1, 10)).toBe(0);
  });

  it("surrounds the castle with four separate floating guard towers", () => {
    const world = generateWorld(3);
    const map = mapDef(3);
    expect(map.mids).toHaveLength(4);
    for (const tower of map.mids) {
      expect(world.get(tower.x + 2, 6, tower.z)).toBe(BLOCK.STONE);
      expect(world.get(tower.x, 0, tower.z)).toBe(BLOCK.STONE);
      expect(world.get(Math.round(tower.x * 0.7), 0, Math.round(tower.z * 0.7))).toBe(0);
    }
  });

  it("keeps spawn points and loot chests unobstructed and supported", () => {
    const map = mapDef(3);
    const world = generateWorld(3);
    for (const p of [...map.spawns, ...map.chests]) {
      expect(world.get(p.x, 0, p.z)).not.toBe(0);
      expect(world.get(p.x, 1, p.z)).toBe(0);
      expect(world.get(p.x, 2, p.z)).toBe(0);
    }
    expect(new Set(map.chests.map((c) => c.id)).size).toBe(map.chests.length);
  });

  it("generates exactly the same castle blocks on every client", () => {
    expect([...generateWorld(3).blocks]).toEqual([...generateWorld(3).blocks]);
    expect(mapDef(4).name).toBe(mapDef(0).name);
  });
});