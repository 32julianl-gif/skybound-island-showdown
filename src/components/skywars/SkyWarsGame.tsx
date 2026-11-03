import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect } from "react";
import { Scene } from "./Scene";
import { Hud } from "./Hud";
import { InventoryScreen } from "./InventoryScreen";
import { Chat } from "./Chat";
import { connect, playerId, send } from "@/game/net";
import { G, handleEvent, onPresence, startRound, eatHeldFood, tickEating, invChanged } from "@/game/engine";
import { hud } from "@/game/store";
import { EatingOverlay } from "./EatingOverlay";

export function SkyWarsGame({ room, name }: { room: string; name: string }) {
  useEffect(() => {
    G.name = name;
    if (import.meta.env.DEV) {
      const debugWindow = window as typeof window & { __game?: unknown };
      debugWindow.__game = {
        get state() { return { id: playerId, phase: G.phase, health: G.self.health, armor: G.self.armor, inventory: G.self.inv, eating: G.self.eating, remotes: [...G.remotes.values()], roster: G.roster, position: G.self.pos.toArray(), chat: hud.get().chat, spectator: G.self.spectator }; },
        startRound,
        eat: eatHeldFood,
        tickEating,
        prepareFood(id = "apple") { G.self.health = 10; G.self.inv[0] = { id, n: 2 }; G.self.sel = 0; hud.set({ health: 10 }); invChanged(); },
        place(x: number, y: number, z: number, yaw = 0) { G.self.pos.set(x, y, z); G.self.vel.set(0, 0, 0); G.self.yaw = yaw; G.self.pitch = 0; },
        hit(target: string, damage = 4) { send("hit", { from: playerId, target, damage, power: 10, dx: 1, dz: 0, round: G.round }); },
        equip(ids: string[]) { G.self.armor = ids.map((id) => ({ id, n: 1 })); hud.set({ invV: hud.get().invV + 1 }); },
      };
    }
    return connect(room, name, handleEvent, onPresence, (ok) => hud.set({ connected: ok }));
  }, [room, name]);

  return (
    <div className="fixed inset-0 bg-background">
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 75, near: 0.05, far: 220 }}>
        <color attach="background" args={["#9fd3f2"]} />
        <fog attach="fog" args={["#bfe2f5", 45, 130]} />
        <hemisphereLight args={["#e8f4ff", "#6b7a52", 0.8]} />
        <directionalLight
          position={[30, 50, 18]}
          intensity={2.4}
          color="#fff1d6"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-34}
          shadow-camera-right={34}
          shadow-camera-top={34}
          shadow-camera-bottom={-34}
          shadow-camera-far={120}
          shadow-bias={-0.0005}
        />
        <Environment resolution={64}>
          <Lightformer intensity={1.6} position={[0, 6, 0]} scale={[12, 12, 1]} rotation-x={Math.PI / 2} />
          <Lightformer intensity={0.8} color="#ffd7a1" position={[-6, 1, -2]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
        </Environment>
        <Scene />
      </Canvas>
      <Hud room={room} />
      <EatingOverlay />
      <InventoryScreen />
      <Chat />
    </div>
  );
}
