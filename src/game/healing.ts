import { MAX_HEALTH } from "./combat";

export const REGEN_INTERVAL_MS = 5000;
export const REGEN_HP = 1;

export function healedHealth(health: number, amount: number) {
  return Math.min(MAX_HEALTH, health + Math.max(0, amount));
}

export function regenerationStep(health: number, lastAt: number, now: number) {
  const ticks = Math.max(0, Math.floor((now - lastAt) / REGEN_INTERVAL_MS));
  return { health: healedHealth(health, ticks * REGEN_HP), lastAt: lastAt + ticks * REGEN_INTERVAL_MS };
}