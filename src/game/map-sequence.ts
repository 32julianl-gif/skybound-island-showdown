import { MAP_COUNT } from "./world";

/** Seeded shuffled bags: every map appears once per cycle on every client. */
export function mapForRound(seed: number, round: number): number {
  const index = Math.max(0, round - 1);
  let state = (seed ^ Math.imul(Math.floor(index / MAP_COUNT) + 1, 0x9e3779b9)) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length: MAP_COUNT }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = order[i];
    const b = order[j];
    if (a === undefined || b === undefined) continue;
    order[i] = b;
    order[j] = a;
  }
  return order[index % MAP_COUNT] ?? 0;
}