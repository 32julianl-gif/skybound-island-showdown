import { expect, it } from "vitest";
import { mapForRound } from "./map-sequence";
import { MAP_COUNT } from "./world";

it("shuffles all four maps instead of following the fixed sequence", () => {
  const sequence = Array.from({ length: 4 }, (_, i) => mapForRound(123, i + 1));
  expect(sequence).not.toEqual([0, 1, 2, 3]);
  expect([...sequence].sort()).toEqual([0, 1, 2, 3]);
});
it("gives different rooms different sequences and matching clients identical maps", () => {
  const a = Array.from({ length: 12 }, (_, i) => mapForRound(123, i + 1));
  expect(a).toEqual(Array.from({ length: 12 }, (_, i) => mapForRound(123, i + 1)));
  expect(a).not.toEqual(Array.from({ length: 12 }, (_, i) => mapForRound(456, i + 1)));
  for (let i = 0; i < 12; i += MAP_COUNT) expect(new Set(a.slice(i, i + MAP_COUNT)).size).toBe(MAP_COUNT);
});