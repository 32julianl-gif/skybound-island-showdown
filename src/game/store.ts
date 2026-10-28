import { useSyncExternalStore } from "react";

export type Phase = "waiting" | "playing" | "ended";
export type FeedItem = { id: number; text: string };

export type HudState = {
  version: number;
  phase: Phase;
  roster: { id: string; name: string }[];
  aliveIds: string[];
  isHost: boolean;
  invV: number;
  ui: null | "inv" | number;
  breakProgress: number;
  bowCharge: number;
  feed: FeedItem[];
  winner: string;
  locked: boolean;
  hurt: number;
  spectator: boolean;
  opened: number;
  connected: boolean;
};

let state: HudState = {
  version: 0,
  phase: "waiting",
  roster: [],
  aliveIds: [],
  isHost: false,
  invV: 0,
  ui: null,
  breakProgress: 0,
  bowCharge: 0,
  feed: [],
  winner: "",
  locked: false,
  hurt: 0,
  spectator: false,
  opened: 0,
  connected: false,
};
const listeners = new Set<() => void>();

export const hud = {
  get: () => state,
  set(p: Partial<HudState>) {
    state = { ...state, ...p };
    listeners.forEach((l) => l());
  },
  sub(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useHud<T>(sel: (s: HudState) => T): T {
  return useSyncExternalStore(hud.sub, () => sel(hud.get()), () => sel(hud.get()));
}

let feedId = 0;
export function pushFeed(text: string) {
  const item = { id: ++feedId, text };
  hud.set({ feed: [...hud.get().feed, item].slice(-5) });
  setTimeout(() => hud.set({ feed: hud.get().feed.filter((f) => f.id !== item.id) }), 6000);
}

