import { MAX_HEALTH } from "./combat";

export const REGEN_INTERVAL_MS = 5000;
export const REGEN_HP = 1;
export const EAT_DURATION_MS = 1600;

export function eatingProgress(startedAt: number, now: number) {
  return Math.max(0, Math.min(1, (now - startedAt) / EAT_DURATION_MS));
}

export function healedHealth(health: number, amount: number) {
  return Math.min(MAX_HEALTH, health + Math.max(0, amount));
}

export function regenerationStep(health: number, lastAt: number, now: number) {
  const ticks = Math.max(0, Math.floor((now - lastAt) / REGEN_INTERVAL_MS));
  return { health: healedHealth(health, ticks * REGEN_HP), lastAt: lastAt + ticks * REGEN_INTERVAL_MS };
}