import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect } from "react";
import { Scene } from "./Scene";
import { Hud } from "./Hud";
import { InventoryScreen } from "./InventoryScreen";
import { connect } from "@/game/net";
import { G, handleEvent, onPresence } from "@/game/engine";
import { hud } from "@/game/store";

export function SkyWarsGame({ room, name }: { room: string; name: string }) {
  useEffect(() => {
    G.name = name;
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
      <InventoryScreen />
    </div>
  );
}
