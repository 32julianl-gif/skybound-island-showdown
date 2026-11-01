// Pure item / inventory rules (no React, no three.js).
export type Item = { id: string; n: number };
export type Slot = Item | null;
export type ArmorPart = 0 | 1 | 2 | 3; // helmet, chestplate, leggings, boots

type Def = {
  name: string;
  icon: string;
  stack: number;
  tier?: number; // 0 wood/leather, 1 stone/iron? see below
  power?: number; // melee knockback
  armor?: { part: ArmorPart; points: number };
  block?: number;
  heal?: number;
};

const TIERS = ["leather", "iron", "diamond"] as const;
const PARTS = ["helmet", "chestplate", "leggings", "boots"] as const;
const PART_ICON = ["🪖", "🦺", "👖", "🥾"];
const ARMOR_PTS = [
  [1, 3, 2, 1],
  [2, 6, 5, 2],
  [3, 8, 6, 3],
];

export const DEFS: Record<string, Def> = {
  wood_sword: { name: "Wood Sword", icon: "🗡️", stack: 1, tier: 0, power: 10 },
  stone_sword: { name: "Stone Sword", icon: "🗡️", stack: 1, tier: 1, power: 12 },
  iron_sword: { name: "Iron Sword", icon: "🗡️", stack: 1, tier: 2, power: 14 },
  diamond_sword: { name: "Diamond Sword", icon: "🗡️", stack: 1, tier: 3, power: 17 },
  bow: { name: "Bow", icon: "🏹", stack: 1 },
  arrow: { name: "Arrow", icon: "➶", stack: 64 },
  apple: { name: "Apple", icon: "🍎", stack: 64, heal: 4 },
  bread: { name: "Bread", icon: "🍞", stack: 64, heal: 6 },
};
TIERS.forEach((t, ti) =>
  PARTS.forEach((p, pi) => {
    DEFS[`${t}_${p}`] = {
      name: `${t[0]!.toUpperCase()}${t.slice(1)} ${p[0]!.toUpperCase()}${p.slice(1)}`,
      icon: PART_ICON[pi]!,
      stack: 1,
      tier: ti === 0 ? 0 : ti + 1,
      armor: { part: pi as ArmorPart, points: ARMOR_PTS[ti]![pi]! },
    };
  }),
);
const BLOCK_NAMES: Record<number, string> = {
  1: "Grass", 2: "Dirt", 3: "Stone", 4: "Planks", 5: "Leaves", 6: "Wool", 7: "Log",
};
for (const [t, name] of Object.entries(BLOCK_NAMES))
  DEFS[`b${t}`] = { name, icon: "■", stack: 64, block: Number(t) };

export const def = (id: string) => DEFS[id]!;
export const FIST_POWER = 7;
export const INV_SIZE = 36; // 0-8 hotbar
export const CHEST_SIZE = 27;

/** Seconds to break a block type by hand. */
export const BREAK_TIME: Record<number, number> = {
  1: 0.9, 2: 0.75, 3: 3, 4: 1.6, 5: 0.3, 6: 0.45, 7: 1.9,
};

/** Damage and knockback absorbed by worn armor: 3% per point, capped at 60%. */
export function armorReduction(armor: Slot[]) {
  const pts = armor.reduce((s, a) => s + (a ? def(a.id).armor?.points ?? 0 : 0), 0);
  return Math.min(0.6, pts * 0.03);
}

/** Adds an item, stacking first. Returns leftover count. */
export function addItem(inv: Slot[], id: string, n: number): number {
  const max = def(id).stack;
  for (let i = 0; i < inv.length && n > 0; i++) {
    const s = inv[i];
    if (s && s.id === id && s.n < max) {
      const k = Math.min(max - s.n, n);
      s.n += k;
      n -= k;
    }
  }
  for (let i = 0; i < inv.length && n > 0; i++) {
    if (!inv[i]) {
      const k = Math.min(max, n);
      inv[i] = { id, n: k };
      n -= k;
    }
  }
  return n;
}

export function countItem(inv: Slot[], id: string) {
  return inv.reduce((s, it) => s + (it?.id === id ? it.n : 0), 0);
}

export function removeItem(inv: Slot[], id: string, n: number) {
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
    const s = inv[i];
    if (s?.id !== id) continue;
    const k = Math.min(s.n, n);
    s.n -= k;
    n -= k;
    if (s.n <= 0) inv[i] = null;
  }
}

function rnd(seed: number) {
  let h = seed | 0;
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Deterministic chest loot: every client computes the same contents for a round. */
export function chestLoot(round: number, chestId: number): Slot[] {
  const r = rnd(round * 7919 + chestId * 104729 + 17);
  const mid = chestId >= 8;
  const out: Slot[] = Array(CHEST_SIZE).fill(null);
  const put = (id: string, n = 1) => {
    for (let tries = 0; tries < 40; tries++) {
      const i = Math.floor(r() * CHEST_SIZE);
      if (!out[i]) { out[i] = { id, n }; return; }
    }
  };
  put("b6", 16 + Math.floor(r() * 24));
  if (r() < 0.6) put("b6", 16);
  const swords = mid ? ["stone_sword", "iron_sword", "diamond_sword"] : ["wood_sword", "stone_sword", "iron_sword"];
  if (r() < 0.85) put(swords[Math.floor(r() * swords.length)]!);
  if (r() < (mid ? 0.6 : 0.35)) put("bow");
  if (r() < 0.7) put("arrow", 4 + Math.floor(r() * 12));
  put(mid ? "bread" : "apple", 2 + Math.floor(r() * 3));
  const tiers = mid ? ["iron", "diamond"] : ["leather", "iron"];
  const pieces = 1 + Math.floor(r() * (mid ? 3 : 2));
  for (let k = 0; k < pieces; k++) {
    put(`${tiers[Math.floor(r() * tiers.length)]}_${PARTS[Math.floor(r() * 4)]}`);
  }
  return out;
}

/** CSS tint per tier for slot borders. */
export const tierClass = (id: string) => {
  const d = def(id);
  if (d.block) return `block-${d.block}`;
  return d.tier === undefined ? "" : `tier-${d.tier}`;
};
