import * as THREE from "three";
import { generateWorld, key, mapDef, MAP_COUNT, BLOCK } from "./world";
import { hud, pushFeed, type Phase } from "./store";
import { playerId, send, type NetEvent } from "./net";
import { addItem, armorReduction, chestLoot, CHEST_SIZE, INV_SIZE, type Slot } from "./items";

export type Arrow = { id: number; from: string; p: THREE.Vector3; v: THREE.Vector3; stuck: number };

export type NetState = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  alive: boolean;
};

export const G = {
  name: "",
  world: generateWorld(0),
  map: 0,
  edits: new Map<string, number>(),
  opened: new Set<number>(),
  phase: "waiting" as Phase,
  round: 0,
  alive: new Set<string>(),
  startCount: 0,
  roster: [] as { id: string; name: string }[],
  remotes: new Map<string, NetState>(),
  presence: [] as { id: string; name: string }[],
  lastSeen: new Map<string, { name: string; at: number }>(),
  synced: false,
  spawnIdx: -1,
  endAt: 0,
  chests: new Map<number, Slot[]>(),
  ui: { open: null as null | "inv" | number, cursor: null as Slot },
  arrows: [] as Arrow[],
  self: {
    pos: new THREE.Vector3(22.5, 1, 0.5),
    vel: new THREE.Vector3(),
    kb: new THREE.Vector2(),
    yaw: 0,
    pitch: 0,
    onGround: false,
    spectator: false,
    crouch: false,
    inv: Array(INV_SIZE).fill(null) as Slot[],
    armor: [null, null, null, null] as Slot[],
    sel: 0,
    lastHitter: "",
    lastHitAt: -1e9,
  },
};

const sortedIds = () => G.roster.map((r) => r.id).sort();
export const isHost = () => sortedIds()[0] === playerId;
export const nameOf = (id: string) =>
  G.roster.find((r) => r.id === id)?.name ?? G.remotes.get(id)?.name ?? "Player";

export function invChanged() {
  hud.set({ invV: hud.get().invV + 1 });
}

export function getChest(id: number): Slot[] {
  let c = G.chests.get(id);
  if (!c) {
    c = G.round > 0 ? chestLoot(G.round, id) : Array(CHEST_SIZE).fill(null);
    G.chests.set(id, c);
  }
  return c;
}

export function setChestSlot(id: number, slot: number, item: Slot, broadcast: boolean) {
  getChest(id)[slot] = item ? { ...item } : null;
  invChanged();
  if (broadcast) send("chest", { id, slot, item });
}

function resetInventory(withStarter: boolean) {
  const me = G.self;
  me.inv = Array(INV_SIZE).fill(null);
  me.armor = [null, null, null, null];
  me.sel = 0;
  G.ui.cursor = null;
  if (withStarter) {
    addItem(me.inv, "wood_sword", 1);
    addItem(me.inv, "b6", 16);
  }
  closeUi();
  invChanged();
}

export function closeUi() {
  if (G.ui.cursor) {
    addItem(G.self.inv, G.ui.cursor.id, G.ui.cursor.n);
    G.ui.cursor = null;
  }
  G.ui.open = null;
  hud.set({ ui: null });
}

function bump() {
  hud.set({ version: hud.get().version + 1 });
}

export function teleportToSpawn(i: number) {
  const sp = mapDef(G.map).spawns;
  // spawn spots rotate every round
  const j = i + G.round * 3;
  const s = sp[((j % sp.length) + sp.length) % sp.length]!;
  const me = G.self;
  me.pos.set(s.x + 0.5, 1, s.z + 0.5);
  me.vel.set(0, 0, 0);
  me.kb.set(0, 0);
  me.yaw = Math.atan2(s.x, s.z);
  me.pitch = -0.15;
}

function resetWorld() {
  G.world = generateWorld(G.map);
  hud.set({ mapName: mapDef(G.map).name });
  G.edits.clear();
  G.opened.clear();
  G.chests.clear();
  G.arrows = [];
  hud.set({ opened: 0 });
  bump();
}

export function applyBlock(x: number, y: number, z: number, t: number, broadcast: boolean) {
  G.world.set(x, y, z, t);
  G.edits.set(key(x, y, z), t);
  bump();
  if (broadcast) send("block", { x, y, z, t });
}

export function openChest(id: number, broadcast: boolean) {
  if (G.opened.has(id)) return;
  G.opened.add(id);
  hud.set({ opened: G.opened.size });
  if (broadcast) send("chest", { id });
}

function syncHud() {
  hud.set({
    phase: G.phase,
    aliveIds: [...G.alive],
    spectator: G.self.spectator,
    isHost: isHost(),
  });
}

function checkEnd() {
  if (G.phase !== "playing") return;
  const done = (G.startCount > 1 && G.alive.size <= 1) || G.alive.size === 0;
  if (!done) return;
  G.phase = "ended";
  G.endAt = performance.now();
  const w = [...G.alive][0];
  hud.set({ winner: w ? nameOf(w) : "" });
  syncHud();
}

export function startRound() {
  if (!isHost() || G.phase !== "waiting") return;
  const payload = { round: G.round + 1, ids: sortedIds() };
  send("start", payload);
  handleEvent("start", payload);
}

export function hostTick() {
  if (G.phase === "ended" && isHost() && performance.now() - G.endAt > 7000) {
    G.endAt = Infinity;
    send("reset", {});
    handleEvent("reset", {});
  }
}

export function die() {
  const me = G.self;
  const by = performance.now() - me.lastHitAt < 10000 ? me.lastHitter : "";
  me.spectator = true;
  resetInventory(false);
  me.pos.set(0, 22, 12);
  me.vel.set(0, 0, 0);
  me.kb.set(0, 0);
  const payload = { id: playerId, by };
  send("dead", payload);
  handleEvent("dead", payload);
}

export function handleEvent(event: NetEvent, p: any) {
  const me = G.self;
  switch (event) {
    case "state": {
      G.remotes.set(p.id, p as NetState);
      const known = G.roster.some((r) => r.id === p.id);
      G.lastSeen.set(p.id, { name: p.name, at: performance.now() });
      if (!known) refreshRoster();
      break;
    }
    case "block":
      applyBlock(p.x, p.y, p.z, p.t, false);
      break;
    case "chest":
      openChest(p.id, false);
      if (typeof p.slot === "number") setChestSlot(p.id, p.slot, p.item ?? null, false);
      break;
    case "arrow":
      if (p.from === playerId) return;
      G.arrows.push({
        id: p.id,
        from: p.from,
        p: new THREE.Vector3(p.x, p.y, p.z),
        v: new THREE.Vector3(p.vx, p.vy, p.vz),
        stuck: -1,
      });
      break;
    case "hit": {
      if (p.target !== playerId || G.phase !== "playing" || me.spectator) return;
      const k = 1 - armorReduction(me.armor);
      me.kb.x += p.dx * p.power * k;
      me.kb.y += p.dz * p.power * k;
      me.vel.y = Math.max(me.vel.y, 6.5);
      me.lastHitter = p.from;
      me.lastHitAt = performance.now();
      hud.set({ hurt: Date.now() });
      break;
    }
    case "dead": {
      if (!G.alive.has(p.id)) return;
      G.alive.delete(p.id);
      pushFeed(
        p.by
          ? `${nameOf(p.id)} was knocked into the void by ${nameOf(p.by)}`
          : `${nameOf(p.id)} fell into the void`,
      );
      syncHud();
      checkEnd();
      break;
    }
    case "start": {
      G.round = p.round;
      G.map = p.round % MAP_COUNT;
      resetWorld();
      const ids: string[] = p.ids;
      G.alive = new Set(ids);
      G.startCount = ids.length;
      G.phase = "playing";
      G.synced = true;
      hud.set({ winner: "" });
      const idx = ids.indexOf(playerId);
      if (idx >= 0) {
        me.spectator = false;
        resetInventory(true);
        me.lastHitter = "";
        teleportToSpawn(idx);
        pushFeed("Round started — knock everyone off!");
      } else {
        me.spectator = true;
        me.pos.set(0, 22, 12);
      }
      syncHud();
      break;
    }
    case "reset": {
      G.phase = "waiting";
      G.map = (G.round + 1) % MAP_COUNT;
      resetWorld();
      G.alive.clear();
      me.spectator = false;
      resetInventory(false);
      G.spawnIdx = sortedIds().indexOf(playerId);
      teleportToSpawn(G.spawnIdx);
      hud.set({ winner: "" });
      syncHud();
      break;
    }
    case "sync": {
      if (G.synced || p.to !== playerId) return;
      G.synced = true;
      G.round = p.round;
      G.map = p.phase === "waiting" ? (p.round + 1) % MAP_COUNT : p.round % MAP_COUNT;
      if (p.phase === "waiting") {
        resetWorld();
        teleportToSpawn(Math.max(0, G.spawnIdx));
        return;
      }
      resetWorld();
      for (const [k, t] of p.edits as [string, number][]) {
        const [x = 0, y = 0, z = 0] = k.split(",").map(Number);
        G.world.set(x, y, z, t);
        G.edits.set(k, t);
      }
      for (const id of p.opened as number[]) G.opened.add(id);
      for (const [id, c] of (p.chests ?? []) as [number, Slot[]][]) G.chests.set(id, c);
      hud.set({ opened: G.opened.size });
      G.alive = new Set(p.alive);
      G.startCount = p.startCount;
      G.phase = p.phase;
      me.spectator = true;
      me.pos.set(0, 22, 12);
      bump();
      syncHud();
      break;
    }
  }
}

/** Presence can flicker; a player counts as present if in presence OR sent state in the last 3s. */
export function onPresence(list: { id: string; name: string }[]) {
  G.presence = list;
  refreshRoster();
}

export function refreshRoster() {
  const now = performance.now();
  const map = new Map(G.presence.map((r) => [r.id, r.name]));
  for (const [id, v] of G.lastSeen) {
    if (now - v.at > 3000) G.lastSeen.delete(id);
    else if (!map.has(id)) map.set(id, v.name);
  }
  if (!map.has(playerId)) map.set(playerId, G.name);
  const list = [...map].map(([id, name]) => ({ id, name }));
  const same =
    list.length === G.roster.length && list.every((r) => G.roster.some((o) => o.id === r.id && o.name === r.name));
  if (!same) onRoster(list);
}

function onRoster(list: { id: string; name: string }[]) {
  const prev = new Set(G.roster.map((r) => r.id));
  G.roster = list;
  const ids = new Set(list.map((r) => r.id));
  for (const id of [...G.remotes.keys()]) if (!ids.has(id)) G.remotes.delete(id);
  if (list.length === 1 && list[0]!.id === playerId) G.synced = true;

  // host brings late joiners up to date
  if (isHost() && G.synced) {
    for (const r of list) {
      if (prev.has(r.id) || r.id === playerId) continue;
      send("sync", {
        to: r.id,
        phase: G.phase,
        round: G.round,
        alive: [...G.alive],
        startCount: G.startCount,
        opened: [...G.opened],
        chests: [...G.chests.entries()],
        edits: [...G.edits.entries()],
      });
    }
  }

  if (G.phase === "playing") {
    let changed = false;
    for (const id of [...G.alive])
      if (!ids.has(id)) {
        G.alive.delete(id);
        changed = true;
      }
    if (changed) checkEnd();
  }

  if (G.phase === "waiting") {
    const idx = [...ids].sort().indexOf(playerId);
    if (idx >= 0 && idx !== G.spawnIdx) {
      G.spawnIdx = idx;
      teleportToSpawn(idx);
    }
  }
  hud.set({ roster: list });
  syncHud();
}

export { BLOCK };
