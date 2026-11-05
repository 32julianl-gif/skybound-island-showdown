// Player-adjustable settings, persisted locally; pure rules stay testable.
export const MIN_SENSITIVITY = 0.2;
export const MAX_SENSITIVITY = 4;
export const DEFAULT_SENSITIVITY = 1;

const STORAGE_KEY = "skywars.sensitivity";

/** Clamp any untrusted input (storage, slider) into the usable range. */
export function clampedSensitivity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SENSITIVITY;
  return Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, Math.round(value * 100) / 100));
}

function load(): number {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_SENSITIVITY;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SENSITIVITY;
    return clampedSensitivity(Number(raw));
  } catch {
    return DEFAULT_SENSITIVITY;
  }
}

/** Mutable so the frame loop reads it with zero React overhead. */
export const settings = { sensitivity: load() };

export function setSensitivity(value: number): number {
  settings.sensitivity = clampedSensitivity(value);
  try {
    localStorage.setItem(STORAGE_KEY, String(settings.sensitivity));
  } catch {
    // storage unavailable (private mode); keep the in-memory value
  }
  return settings.sensitivity;
}
