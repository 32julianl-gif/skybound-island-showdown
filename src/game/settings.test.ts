import { describe, expect, it } from "vitest";
import {
  clampedSensitivity,
  DEFAULT_SENSITIVITY,
  MAX_SENSITIVITY,
  MIN_SENSITIVITY,
  setSensitivity,
  settings,
} from "./settings";

describe("clampedSensitivity", () => {
  it("keeps normal values", () => {
    expect(clampedSensitivity(1)).toBe(1);
    expect(clampedSensitivity(1.5)).toBe(1.5);
  });
  it("clamps to the bounds", () => {
    expect(clampedSensitivity(0)).toBe(MIN_SENSITIVITY);
    expect(clampedSensitivity(-3)).toBe(MIN_SENSITIVITY);
    expect(clampedSensitivity(99)).toBe(MAX_SENSITIVITY);
  });
  it("falls back to the default for non-finite input", () => {
    expect(clampedSensitivity(Number.NaN)).toBe(DEFAULT_SENSITIVITY);
    expect(clampedSensitivity(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SENSITIVITY);
  });
});

describe("setSensitivity", () => {
  it("stores the clamped value on the live settings object", () => {
    expect(setSensitivity(2.4)).toBe(2.4);
    expect(settings.sensitivity).toBe(2.4);
    expect(setSensitivity(1000)).toBe(MAX_SENSITIVITY);
    expect(settings.sensitivity).toBe(MAX_SENSITIVITY);
  });
});
