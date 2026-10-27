import * as THREE from "three";
import { generateWorld, key, SPAWNS, BLOCK } from "./world";
import { hud, pushFeed, type Phase } from "./store";
import { playerId, send, type NetEvent } from "./net";

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
  world: generateWorld(),
  edits: new Map<string, number>(),
  opened: new Set<number>(),
  phase: "waiting" as Phase,
  round: 0,
  alive: new Set<string>(),
  startCount: 0,
  roster: [] as { id: string; name: string }[],
  remotes: new Map<string, NetState>(),
  synced: false,
  spawnIdx: -1,
  endAt: 0,
  self: {
    pos: new THREE.Vector3(SPAWNS[0].x + 0.5, 1, SPAWNS[0].z + 0.5),
    vel: new THREE.Vector3(),
    kb: new THREE.Vector2(),
    yaw: 0,
    pitch: 0,
    onGround: false,
    spectator: false,
    blocks: 0,
    sword: 0,
    lastHitter: "",
    lastHitAt: -1e9,
  },
};

const sortedIds = () => G.roster.map((r) => r.id).sort();
export const isHost = () => sortedIds()[0] === playerId;
export const nameOf = (id: string) =>
  G.roster.find((r) => r.id === id)?.name ?? G.remotes.get(id)?.name ?? "Player";

function bump() {
  hud.set({ version: hud.get().version + 1 });
}

export function teleportToSpawn(i: number) {
  const s = SPAWNS[((i % SPAWNS.length) + SPAWNS.length) % SPAWNS.length]!;
  const me = G.self;
  me.pos.set(s.x + 0.5, 1, s.z + 0.5);
  me.vel.set(0, 0, 0);
  me.kb.set(0, 0);
  me.yaw = Math.atan2(s.x, s.z);
  me.pitch = -0.15;
}

function resetWorld() {
  G.world = generateWorld();
  G.edits.clear();
  G.opened.clear();
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
    blocks: G.self.blocks,
    sword: G.self.sword,
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
      break;
    }
    case "block":
      applyBlock(p.x, p.y, p.z, p.t, false);
      break;
    case "chest":
      openChest(p.id, false);
      break;
    case "hit": {
      if (p.target !== playerId || G.phase !== "playing" || me.spectator) return;
      me.kb.x += p.dx * p.power;
      me.kb.y += p.dz * p.power;
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
        me.blocks = 16;
        me.sword = 0;
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
      resetWorld();
      G.alive.clear();
      me.spectator = false;
      me.blocks = 0;
      me.sword = 0;
      G.spawnIdx = sortedIds().indexOf(playerId);
      teleportToSpawn(G.spawnIdx);
      hud.set({ winner: "" });
      syncHud();
      break;
    }
    case "sync": {
      if (G.synced || p.to !== playerId) return;
      G.synced = true;
      if (p.phase === "waiting") return;
      G.round = p.round;
      resetWorld();
      for (const [k, t] of p.edits as [string, number][]) {
        const [x, y, z] = k.split(",").map(Number);
        G.world.set(x, y, z, t);
        G.edits.set(k, t);
      }
      for (const id of p.opened as number[]) G.opened.add(id);
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

export function onRoster(list: { id: string; name: string }[]) {
  const prev = new Set(G.roster.map((r) => r.id));
  G.roster = list;
  const ids = new Set(list.map((r) => r.id));
  for (const id of [...G.remotes.keys()]) if (!ids.has(id)) G.remotes.delete(id);
  if (list.length === 1 && list[0].id === playerId) G.synced = true;

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
