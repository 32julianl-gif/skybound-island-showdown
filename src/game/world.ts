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
type MapCfg = { name: string; ring: number; spawnR: number; center: number; centerDepth: number; mids: number; midRing: number; midR: number; trees: [number, number][]; castle?: boolean; giantTree?: boolean; ruins?: boolean };

const MAPS: MapCfg[] = [
  { name: "Classic Isles", ring: 26, spawnR: 3.5, center: 10, centerDepth: 7, mids: 4, midRing: 16, midR: 2.6, trees: [], giantTree: true },
  { name: "Wide Sky", ring: 30, spawnR: 3, center: 10, centerDepth: 7, mids: 6, midRing: 18, midR: 3.2, trees: [], ruins: true },
  { name: "Archipelago", ring: 19, spawnR: 3.2, center: 4, centerDepth: 4, mids: 8, midRing: 10, midR: 2, trees: [[2, -2]] },
  { name: "Sky Citadel", ring: 42, spawnR: 4, center: 17, centerDepth: 9, mids: 4, midRing: 27, midR: 4.5, trees: [], castle: true },
];
export const MAP_COUNT = MAPS.length;

export function mapDef(map: number) {
  const m = MAPS[((map % MAPS.length) + MAPS.length) % MAPS.length];
  if (!m) throw new Error("No Sky Wars maps configured");
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

function fill(w: World, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, t: number) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) w.set(x, y, z, t);
}

/** A towering editable oak with a hollow trunk, roots, branches and layered crown. */
function giantTree(w: World) {
  for (let y = 1; y <= 19; y++) {
    const r = y < 5 ? 2 : 1;
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
      if (x === 0 && z === 0) continue;
      w.set(x, y, z, BLOCK.LOG);
    }
  }
  // Four doorways keep the courtyard loot and the hollow interior reachable.
  for (const side of [-1, 1]) {
    for (let n = 1; n <= 2; n++) {
      fill(w, side * n, side * n, 1, 3, 0, 0, 0);
      fill(w, 0, 0, 1, 3, side * n, side * n, 0);
    }
  }
  for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    if (dx === undefined || dz === undefined) continue;
    for (let n = 2; n <= 6; n++) {
      w.set(dx * n, 1, dz * n, BLOCK.LOG);
      if (n < 4) w.set(dx * n, 2, dz * n, BLOCK.LOG);
    }
  }
  const crowns: [number, number, number, number][] = [[0, 22, 0, 7], [6, 16, 0, 4], [-6, 17, 0, 4], [0, 18, 6, 4], [0, 16, -6, 4]];
  for (const [cx, cy, cz, r] of crowns) {
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) for (let y = -3; y <= 3; y++) {
      if ((x * x + z * z) / (r * r) + y * y / 16 > 1 + hash(cx + x, cz + z, cy + y) * 0.12) continue;
      if (!w.get(cx + x, cy + y, cz + z)) w.set(cx + x, cy + y, cz + z, BLOCK.LEAVES);
    }
    if (cx !== 0 || cz !== 0) {
      const steps = Math.max(Math.abs(cx), Math.abs(cz));
      for (let n = 1; n <= steps; n++) {
        const y = cy - 3 + Math.floor(n / 2);
        w.set(Math.round(cx * n / steps), y, Math.round(cz * n / steps), BLOCK.LOG);
      }
    }
  }
}

/** Weathered, roofless masonry: gaps, broken parapets, rubble and leaf overgrowth. */
function ruinedTower(w: World, cx: number, cz: number, height: number, seed: number) {
  fill(w, cx - 2, cx + 2, 0, 0, cz - 2, cz + 2, BLOCK.STONE);
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    if (Math.abs(x) !== 2 && Math.abs(z) !== 2) continue;
    const top = height - Math.floor(hash(cx + x, cz + z, seed) * 4);
    for (let y = 1; y <= top; y++) {
      if ((z === -2 || z === 2) && x === 0 && y <= 3) continue;
      if (y > 2 && hash(cx + x, cz + z, seed + y * 13) < 0.18) continue;
      w.set(cx + x, y, cz + z, BLOCK.STONE);
    }
    if (hash(cx + x, cz + z, seed + 91) > 0.5) w.set(cx + x, 1, cz + z, BLOCK.LEAVES);
  }
  // Broken landings stay away from the chest and both open entrances.
  for (let n = 0; n < 3; n++) w.set(cx - 1, n + 1, cz + 1 - n, BLOCK.PLANKS);
  w.set(cx + 1, 1, cz + 1, BLOCK.STONE);
}

function wideRuins(w: World, mids: { x: number; z: number }[]) {
  ruinedTower(w, -5, -4, 10, 101);
  ruinedTower(w, 5, 4, 7, 203);
  // A fractured arch between the central towers, with an open passage below.
  fill(w, -2, -2, 1, 5, -6, -6, BLOCK.STONE);
  fill(w, 2, 2, 1, 4, -6, -6, BLOCK.STONE);
  fill(w, -2, 0, 5, 5, -6, -6, BLOCK.STONE);
  w.set(1, 4, -6, BLOCK.STONE);
  mids.forEach((p, i) => ruinedTower(w, p.x, p.z, 5 + i % 3, 307 + i * 29));
}

/** Hollow towers, open ground-level doorways, and jumpable internal stairs. */
function guardTower(w: World, cx: number, cz: number, height: number) {
  fill(w, cx - 2, cx + 2, 0, 0, cz - 2, cz + 2, BLOCK.STONE);
  for (let y = 1; y <= height; y++) {
    for (let n = -2; n <= 2; n++) {
      w.set(cx + n, y, cz - 2, BLOCK.STONE);
      w.set(cx + n, y, cz + 2, BLOCK.STONE);
      w.set(cx - 2, y, cz + n, BLOCK.STONE);
      w.set(cx + 2, y, cz + n, BLOCK.STONE);
    }
  }
  // Opposite entrances allow crossing the tower without a dead end.
  for (const z of [cz - 2, cz + 2]) fill(w, cx, cx, 1, 3, z, z, 0);
  for (const x of [cx - 2, cx + 2]) fill(w, x, x, 4, 5, cz, cz, 0);
  const stairs: [number, number][] = [[-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1]];
  for (let y = 1; y <= height; y++) {
    const step = stairs[(y - 1) % stairs.length];
    if (step) w.set(cx + step[0], y, cz + step[1], BLOCK.PLANKS);
  }
  // Roof opening preserves headroom above the final stairs.
  fill(w, cx - 2, cx + 2, height, height, cz - 2, cz + 2, BLOCK.PLANKS);
  for (let y = Math.max(1, height - 2); y <= height; y++) {
    const step = stairs[(y - 1) % stairs.length];
    if (step) w.set(cx + step[0], height, cz + step[1], 0);
  }
  for (const x of [-2, 0, 2])
    for (const z of [-2, 0, 2])
      if (Math.abs(x) === 2 || Math.abs(z) === 2) w.set(cx + x, height + 1, cz + z, BLOCK.STONE);
  // Gold-colored wool pennant on a wooden mast.
  fill(w, cx + 2, cx + 2, height + 2, height + 5, cz + 2, cz + 2, BLOCK.LOG);
  fill(w, cx + 3, cx + 4, height + 4, height + 5, cz + 2, cz + 2, BLOCK.WOOL);
}

function castle(w: World) {
  fill(w, -11, 11, 0, 0, -11, 11, BLOCK.STONE);
  for (const edge of [-10, 10]) {
    fill(w, -10, 10, 1, 5, edge, edge, BLOCK.STONE);
    fill(w, edge, edge, 1, 5, -10, 10, BLOCK.STONE);
    fill(w, -10, 10, 5, 5, edge - 1, edge + 1, BLOCK.PLANKS);
    fill(w, edge - 1, edge + 1, 5, 5, -10, 10, BLOCK.PLANKS);
    for (let n = -8; n <= 8; n += 2) {
      w.set(n, 6, edge, BLOCK.STONE);
      w.set(edge, 6, n, BLOCK.STONE);
    }
    // Broad arched gates on every side keep the central loot reachable.
    fill(w, -2, 2, 1, 3, edge, edge, 0);
    fill(w, -1, 1, 4, 4, edge, edge, 0);
    fill(w, edge, edge, 1, 3, -2, 2, 0);
    fill(w, edge, edge, 4, 4, -1, 1, 0);
  }
  for (const x of [-10, 10])
    for (const z of [-10, 10]) guardTower(w, x, z, 9);
  // Tall rear keep leaves an open courtyard around the four central chests.
  guardTower(w, 0, -7, 13);
  for (const x of [-7, 7]) {
    fill(w, x, x, 1, 3, -4, -4, BLOCK.LOG);
    fill(w, x - 1, x + 1, 4, 4, -5, -3, BLOCK.PLANKS);
  }
}

export function generateWorld(map = 0) {
  const d = mapDef(map);
  const w = new World();
  island(w, 0, 0, d.center, d.centerDepth);
  for (const [x, z] of d.trees) tree(w, x, z);
  for (const m of d.mids) island(w, m.x, m.z, d.midR, 3);
  for (const s of d.spawns) island(w, s.x, s.z, d.spawnR, 4);
  if (d.giantTree) giantTree(w);
  if (d.ruins) wideRuins(w, d.mids);
  if (d.castle) {
    castle(w);
    for (const m of d.mids) guardTower(w, m.x, m.z, 7);
  }
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
