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

export type Chest = { id: number; x: number; y: number; z: number };
type MapCfg = { name: string; ring: number; spawnR: number; center: number; centerDepth: number; mids: number; midRing: number; midR: number; trees: [number, number][] };

const MAPS: MapCfg[] = [
  { name: "Classic Isles", ring: 22, spawnR: 3.5, center: 6.5, centerDepth: 6, mids: 4, midRing: 11, midR: 2.6, trees: [[4, 4], [-4, -4]] },
  { name: "Wide Sky", ring: 27, spawnR: 3, center: 8, centerDepth: 7, mids: 6, midRing: 15, midR: 2.2, trees: [[5, -3], [-5, 3], [0, 6]] },
  { name: "Archipelago", ring: 19, spawnR: 3.2, center: 4, centerDepth: 4, mids: 8, midRing: 10, midR: 2, trees: [[2, -2]] },
];
export const MAP_COUNT = MAPS.length;

export function mapDef(map: number) {
  const m = MAPS[((map % MAPS.length) + MAPS.length) % MAPS.length]!;
  const spawns = Array.from({ length: MAX_PLAYERS }, (_, i) => {
    const a = (i / MAX_PLAYERS) * Math.PI * 2;
    return { x: Math.round(Math.cos(a) * m.ring), z: Math.round(Math.sin(a) * m.ring), a };
  });
  const mids = Array.from({ length: m.mids }, (_, i) => {
    const a = ((i * 2 + 1) / (m.mids * 2)) * Math.PI * 2;
    return { x: Math.round(Math.cos(a) * m.midRing), z: Math.round(Math.sin(a) * m.midRing) };
  });
  const c = Math.max(2, Math.floor(m.center / 3));
  const chests: Chest[] = [
    ...spawns.map((s, i) => ({
      id: i,
      x: s.x + Math.round(Math.cos(s.a + Math.PI / 2) * 2),
      y: 1,
      z: s.z + Math.round(Math.sin(s.a + Math.PI / 2) * 2),
    })),
    ...mids.map((p, i) => ({ id: 8 + i, x: p.x, y: 1, z: p.z })),
    { id: 20, x: c, y: 1, z: 0 },
    { id: 21, x: -c, y: 1, z: 0 },
    { id: 22, x: 0, y: 1, z: c },
    { id: 23, x: 0, y: 1, z: -c },
  ];
  return { ...m, spawns, mids, chests };
}

export function generateWorld(map = 0) {
  const d = mapDef(map);
  const w = new World();
  island(w, 0, 0, d.center, d.centerDepth);
  for (const [x, z] of d.trees) tree(w, x, z);
  for (const m of d.mids) island(w, m.x, m.z, d.midR, 3);
  for (const s of d.spawns) island(w, s.x, s.z, d.spawnR, 4);
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
