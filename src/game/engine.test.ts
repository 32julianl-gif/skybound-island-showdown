import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./net", () => ({ playerId: "local", send: vi.fn() }));
import { G, eatHeldFood, handleEvent, tickHealth, tickEating } from "./engine";
import { hud } from "./store";
import { send } from "./net";
import { mapForRound } from "./map-sequence";

beforeEach(() => {
  vi.clearAllMocks();
  G.mapSeed = 0;
  G.roster = [{ id: "local", name: "Local" }, { id: "remote", name: "Remote" }];
  G.chatSeen.clear();
  hud.set({ chat: [] });
  hud.set({ chatOpen: false });
  handleEvent("start", { round: 1, ids: ["local", "remote"] });
});

it("shares the shuffled map through start, reset, and late-join sync", () => {
  handleEvent("start", { round: 3, ids: ["local", "remote"], mapSeed: 123 });
  expect(G.map).toBe(mapForRound(123, 3));
  handleEvent("reset", { mapSeed: 123 });
  expect(G.map).toBe(mapForRound(123, 4));
  G.synced = false;
  handleEvent("sync", { to: "local", phase: "waiting", round: 3, mapSeed: 456 });
  expect(G.mapSeed).toBe(456);
  expect(G.map).toBe(mapForRound(456, 4));
  G.synced = false;
  handleEvent("sync", { to: "local", phase: "playing", round: 3, mapSeed: 123, edits: [], opened: [], alive: ["remote"], startCount: 2 });
  expect(G.map).toBe(mapForRound(123, 3));
});

describe("combat elimination", () => {
  it("deals damage and emits one death when health is depleted", () => {
    const hit = { target: "local", from: "remote", dx: 1, dz: 0, power: 10, damage: 10, round: 1 };
    handleEvent("hit", hit);
    expect(hud.get().health).toBe(10);
    expect(G.self.kb.x).toBe(5);
    handleEvent("hit", hit);
    handleEvent("hit", hit);
    expect(G.self.spectator).toBe(true);
    expect(G.alive.has("local")).toBe(false);
    expect(hud.get().health).toBe(0);
    expect(vi.mocked(send).mock.calls.filter(([event]) => event === "dead")).toHaveLength(1);
    expect(hud.get().winner).toBe("Remote");
  });
  it("ignores damage outside the match and resets health next round", () => {
    handleEvent("hit", { target: "local", from: "remote", dx: 1, dz: 0, power: 10, damage: 4, round: 0 });
    expect(G.self.health).toBe(20);
    handleEvent("hit", { target: "local", from: "remote", dx: 1, dz: 0, power: 10, damage: 4, round: 1 });
    expect(G.self.health).toBe(16);
    handleEvent("reset", {});
    expect(G.self.health).toBe(20);
    expect(G.self.spectator).toBe(false);
  });
});

it("keeps chat in room roster and drops duplicate messages", () => {
  handleEvent("chat", { id: "1", from: "remote", text: "hello" });
  handleEvent("chat", { id: "1", from: "remote", text: "hello" });
  handleEvent("chat", { id: "2", from: "outsider", text: "hello" });
  expect(hud.get().chat).toEqual([{ id: "1", from: "remote", name: "Remote", text: "hello" }]);
});

describe("healing in a round", () => {
  it("regenerates one HP after five seconds and never revives eliminated players", () => {
    G.self.health = 10;
    G.self.regenAt = 100;
    tickHealth(5099);
    expect(G.self.health).toBe(10);
    tickHealth(5100);
    expect(G.self.health).toBe(11);
    expect(hud.get().health).toBe(11);
    G.self.health = 0;
    G.self.spectator = true;
    tickHealth(10100);
    expect(G.self.health).toBe(0);
  });
  it("consumes one food item to heal and does not waste food at full health", () => {
    G.self.health = 10;
    G.self.inv[0] = { id: "apple", n: 2 };
    expect(eatHeldFood(100)).toBe(true);
    expect(G.self.health).toBe(10);
    expect(tickEating(true, 1699)).toBe(false);
    expect(G.self.inv[0]).toEqual({ id: "apple", n: 2 });
    expect(tickEating(true, 1700)).toBe(true);
    expect(G.self.health).toBe(14);
    expect(G.self.inv[0]).toEqual({ id: "apple", n: 1 });
    expect(eatHeldFood(2000)).toBe(true);
    expect(tickEating(true, 3600)).toBe(true);
    expect(G.self.health).toBe(18);
    expect(G.self.inv[0]).toBeNull();
    G.self.health = 20;
    G.self.inv[0] = { id: "bread", n: 1 };
    expect(eatHeldFood()).toBe(false);
    expect(G.self.inv[0]).toEqual({ id: "bread", n: 1 });
  });
  it("cancels eating on release, slot changes, menus, or death without consuming food", () => {
    for (const interruption of ["release", "slot", "menu", "death"]) {
      handleEvent("start", { round: 1, ids: ["local", "remote"] });
      G.self.health = 10;
      G.self.inv[0] = { id: "apple", n: 2 };
      eatHeldFood(100);
      if (interruption === "slot") G.self.sel = 1;
      if (interruption === "menu") G.ui.open = "inv";
      if (interruption === "death") G.self.spectator = true;
      expect(tickEating(interruption !== "release", 1800)).toBe(false);
      expect(G.self.inv[0]).toEqual({ id: "apple", n: 2 });
      expect(G.self.health).toBe(10);
      expect(G.self.eating).toBeNull();
    }
  });
});