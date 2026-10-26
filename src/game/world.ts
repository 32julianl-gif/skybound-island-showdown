// Deterministic voxel world — every client generates the identical map.
export const BLOCK = {
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  PLANKS: 4,
  LEAVES: 5,
  WOOL: 6,
  LOG: 7,
} as const;
export const BLOCK_TYPES = [1, 2, 3, 4, 5, 6, 7];

export const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

export class World {
  blocks = new Map<string, number>();
  get(x: number, y: number, z: number) {
    return this.blocks.get(key(x, y, z)) ?? 0;
  }
  set(x: number, y: number, z: number, t: number) {
    if (t === 0) this.blocks.delete(key(x, y, z));
    else this.blocks.set(key(x, y, z), t);
  }
}

function hash(x: number, z: number, s: number) {
  let h = (x * 374761393 + z * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function island(w: World, cx: number, cz: number, r: number, depth: number) {
  const R = Math.ceil(r) + 1;
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z);
      for (let layer = 0; layer <= depth; layer++) {
        const lr = r * (1 - layer / (depth + 1.2)) + (hash(cx + x, cz + z, layer) - 0.5) * 0.9;
        if (d > lr) continue;
        const t = layer === 0 ? BLOCK.GRASS : layer < 3 ? BLOCK.DIRT : BLOCK.STONE;
        w.set(cx + x, -layer, cz + z, t);
      }
    }
}

function tree(w: World, x: number, z: number) {
  for (let y = 1; y <= 4; y++) w.set(x, y, z, BLOCK.LOG);
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
      for (let dy = 3; dy <= 5; dy++) {
        const edge = Math.abs(dx) + Math.abs(dz) + (dy - 3);
        if (edge > 3) continue;
        if (dx === 0 && dz === 0 && dy <= 4) continue;
        w.set(x + dx, dy, z + dz, BLOCK.LEAVES);
      }
}

export const MAX_PLAYERS = 8;
const RING = 22;

export const SPAWNS = Array.from({ length: MAX_PLAYERS }, (_, i) => {
  const a = (i / MAX_PLAYERS) * Math.PI * 2;
  return { x: Math.round(Math.cos(a) * RING), z: Math.round(Math.sin(a) * RING), a };
});

const MIDS = Array.from({ length: 4 }, (_, i) => {
  const a = ((i * 2 + 1) / 8) * Math.PI * 2;
  return { x: Math.round(Math.cos(a) * 11), z: Math.round(Math.sin(a) * 11) };
});

export type Chest = { id: number; x: number; y: number; z: number };
export const CHESTS: Chest[] = [
  ...SPAWNS.map((s, i) => ({
    id: i,
    x: s.x + Math.round(Math.cos(s.a + Math.PI / 2) * 2),
    y: 1,
    z: s.z + Math.round(Math.sin(s.a + Math.PI / 2) * 2),
  })),
  ...MIDS.map((m, i) => ({ id: 8 + i, x: m.x, y: 1, z: m.z })),
  { id: 12, x: 2, y: 1, z: 0 },
  { id: 13, x: -2, y: 1, z: 0 },
  { id: 14, x: 0, y: 1, z: 2 },
  { id: 15, x: 0, y: 1, z: -2 },
];

export function generateWorld() {
  const w = new World();
  island(w, 0, 0, 6.5, 6);
  tree(w, 4, 4);
  tree(w, -4, -4);
  for (const m of MIDS) island(w, m.x, m.z, 2.6, 3);
  for (const s of SPAWNS) island(w, s.x, s.z, 3.5, 4);
  return w;
}

/** Voxel DDA raycast. Returns hit block + face normal. */
export function raycast(
  w: World,
  o: { x: number; y: number; z: number },
  d: { x: number; y: number; z: number },
  max: number,
) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = d.x ? Math.abs(1 / d.x) : Infinity;
  const tdy = d.y ? Math.abs(1 / d.y) : Infinity;
  const tdz = d.z ? Math.abs(1 / d.z) : Infinity;
  let tmx = d.x > 0 ? (x + 1 - o.x) * tdx : d.x < 0 ? (o.x - x) * tdx : Infinity;
  let tmy = d.y > 0 ? (y + 1 - o.y) * tdy : d.y < 0 ? (o.y - y) * tdy : Infinity;
  let tmz = d.z > 0 ? (z + 1 - o.z) * tdz : d.z < 0 ? (o.z - z) * tdz : Infinity;
  let n: [number, number, number] = [0, 0, 0];
  let t = 0;
  while (t <= max) {
    if (w.get(x, y, z)) return { x, y, z, n };
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; n = [-sx, 0, 0]; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tmz; tmz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}
