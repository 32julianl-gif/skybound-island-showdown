import { expect, it } from "vitest";
import { BLOCK, generateWorld, World } from "./world";
import { surfaceGeometry } from "./voxel-geometry";

function triangleCount(world: World) {
  const geometries = surfaceGeometry(world);
  let triangles = 0;
  for (const g of geometries.values()) { triangles += g.getAttribute("position").count / 3; g.dispose(); }
  return triangles;
}
it("removes shared faces but restores exposed faces after mining", () => {
  const world = new World();
  world.set(0, 0, 0, BLOCK.STONE);
  expect(triangleCount(world)).toBe(12);
  world.set(1, 0, 0, BLOCK.DIRT);
  expect(triangleCount(world)).toBe(20);
  world.set(1, 0, 0, 0);
  expect(triangleCount(world)).toBe(12);
});
it("reduces castle triangles by more than half without deleting game blocks", () => {
  const world = generateWorld(3);
  const blocks = [...world.blocks];
  expect(triangleCount(world)).toBeLessThan(world.blocks.size * 12 * 0.5);
  expect([...world.blocks]).toEqual(blocks);
});