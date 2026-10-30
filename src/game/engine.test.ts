import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./net", () => ({ playerId: "local", send: vi.fn() }));
import { G, handleEvent } from "./engine";
import { hud } from "./store";
import { send } from "./net";

beforeEach(() => {
  vi.clearAllMocks();
  G.roster = [{ id: "local", name: "Local" }, { id: "remote", name: "Remote" }];
  G.chatSeen.clear();
  hud.set({ chat: [] });
  handleEvent("start", { round: 1, ids: ["local", "remote"] });
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