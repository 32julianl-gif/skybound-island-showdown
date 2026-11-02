import * as THREE from "three";
import { BLOCK_TYPES, type World } from "./world";

const neighbors: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** Merge exposed faces only; collision and editable world blocks remain intact. */
export function surfaceGeometry(world: World): Map<number, THREE.BufferGeometry> {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const positions = box.getAttribute("position");
  const normals = box.getAttribute("normal");
  const uvs = box.getAttribute("uv");
  const indices = box.index;
  const buckets = new Map<number, number[][]>();
  for (const t of BLOCK_TYPES) buckets.set(t, neighbors.map(() => []));
  if (indices) for (const [key, t] of world.blocks) {
    const [x = 0, y = 0, z = 0] = key.split(",").map(Number);
    const sides = buckets.get(t);
    if (!sides) continue;
    neighbors.forEach(([dx, dy, dz], face) => {
      if (world.get(x + dx, y + dy, z + dz)) return;
      const data = sides[face];
      const group = box.groups[face];
      if (!data || !group) return;
      for (let n = group.start; n < group.start + group.count; n++) {
        const i = indices.getX(n);
        data.push(positions.getX(i) + x + 0.5, positions.getY(i) + y + 0.5, positions.getZ(i) + z + 0.5,
          normals.getX(i), normals.getY(i), normals.getZ(i), uvs.getX(i), uvs.getY(i));
      }
    });
  }
  box.dispose();
  const result = new Map<number, THREE.BufferGeometry>();
  for (const [t, sides] of buckets) {
    const p: number[] = [], n: number[] = [], uv: number[] = [];
    const geometry = new THREE.BufferGeometry();
    sides.forEach((side, face) => {
      const start = p.length / 3;
      for (let i = 0; i < side.length; i += 8) {
        p.push(side[i] ?? 0, side[i + 1] ?? 0, side[i + 2] ?? 0);
        n.push(side[i + 3] ?? 0, side[i + 4] ?? 0, side[i + 5] ?? 0);
        uv.push(side[i + 6] ?? 0, side[i + 7] ?? 0);
      }
      geometry.addGroup(start, p.length / 3 - start, face);
    });
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    if (p.length) { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
    result.set(t, geometry);
  }
  return result;
}