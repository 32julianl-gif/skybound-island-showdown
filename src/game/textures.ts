import * as THREE from "three";
import { BLOCK } from "./world";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

type Draw = (ctx: CanvasRenderingContext2D, r: () => number) => void;

function tex(draw: Draw, seed: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const ctx = c.getContext("2d")!;
  draw(ctx, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number, s: number, l: number) => {
  ctx.fillStyle = `hsl(${h},${s}%,${l}%)`;
  ctx.fillRect(x, y, 1, 1);
};

const noise = (h: number, s: number, l: number, v: number): Draw => (ctx, r) => {
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) px(ctx, x, y, h, s, l + (r() - 0.5) * v);
};

const grassTop = noise(98, 48, 44, 14);
const dirt = noise(28, 38, 33, 10);
const grassSide: Draw = (ctx, r) => {
  dirt(ctx, r);
  for (let x = 0; x < 16; x++) {
    const d = 3 + Math.floor(r() * 3);
    for (let y = 0; y < d; y++) px(ctx, x, y, 98, 48, 44 + (r() - 0.5) * 12);
  }
};
const stone = noise(215, 7, 54, 16);
const planks: Draw = (ctx, r) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const seam = y % 4 === 3 || (x === ((y >> 2) % 2 ? 4 : 11) && true);
      px(ctx, x, y, 34, 52, (seam ? 34 : 50) + (r() - 0.5) * 6);
    }
};
const logSide: Draw = (ctx, r) => {
  for (let x = 0; x < 16; x++) {
    const base = 26 + (x % 3 === 0 ? -6 : 0);
    for (let y = 0; y < 16; y++) px(ctx, x, y, 28, 36, base + (r() - 0.5) * 6);
  }
};
const logTop: Draw = (ctx, r) => {
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 16; y++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      const ring = Math.floor(d) % 3 === 0;
      px(ctx, x, y, 36, 45, (d > 7 ? 26 : ring ? 40 : 52) + (r() - 0.5) * 5);
    }
};
const leaves = noise(118, 46, 30, 22);
const wool: Draw = (ctx, r) => {
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 16; y++) px(ctx, x, y, 44, 88, 60 + (r() - 0.5) * 8 + ((x + y) % 4 === 0 ? -6 : 0));
};

let cache: Record<number, THREE.Material[]> | null = null;
let chestMat: THREE.Material[] | null = null;

const mat = (t: THREE.Texture) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0 });

export function getBlockMaterials() {
  if (cache) return cache;
  const g = mat(tex(grassTop, 3));
  const gs = mat(tex(grassSide, 5));
  const d = mat(tex(dirt, 7));
  const s = mat(tex(stone, 11));
  const p = mat(tex(planks, 13));
  const l = mat(tex(leaves, 17));
  const w = mat(tex(wool, 19));
  const ls = mat(tex(logSide, 23));
  const lt = mat(tex(logTop, 29));
  const six = (m: THREE.Material) => [m, m, m, m, m, m];
  cache = {
    [BLOCK.GRASS]: [gs, gs, g, d, gs, gs],
    [BLOCK.DIRT]: six(d),
    [BLOCK.STONE]: six(s),
    [BLOCK.PLANKS]: six(p),
    [BLOCK.LEAVES]: six(l),
    [BLOCK.WOOL]: six(w),
    [BLOCK.LOG]: [ls, ls, lt, lt, ls, ls],
  };
  return cache;
}

export function getChestMaterials() {
  if (chestMat) return chestMat;
  const side = tex((ctx, r) => {
    planks(ctx, r);
    ctx.fillStyle = "hsl(30,40%,22%)";
    ctx.fillRect(0, 6, 16, 1);
    ctx.fillStyle = "hsl(48,20%,78%)";
    ctx.fillRect(7, 5, 2, 3);
  }, 31);
  const m = mat(side);
  chestMat = [m, m, mat(tex(planks, 37)), m, m, m];
  return chestMat;
}
