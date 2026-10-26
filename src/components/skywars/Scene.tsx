import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BLOCK, BLOCK_TYPES, CHESTS, raycast } from "@/game/world";
import { getBlockMaterials, getChestMaterials } from "@/game/textures";
import { G, applyBlock, die, hostTick, openChest, startRound, teleportToSpawn } from "@/game/engine";
import { hud, pushFeed, useHud, SWORD_POWER, SWORDS } from "@/game/store";
import { playerId, send } from "@/game/net";

// ---------- feel constants ----------
const SPEED = 5.2;
const GROUND_ACCEL = 14;
const AIR_ACCEL = 3;
const GRAVITY = 28;
const JUMP = 8.6;
const KB_DRAG_GROUND = 6;
const KB_DRAG_AIR = 1.1;
const REACH = 3.8;
const NET_TICK = 1 / 8;
const HALF_W = 0.3;
const HEIGHT = 1.8;
const EYE = 1.62;

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// ---------- input (module-level, read in frame loop) ----------
const keys: Record<string, boolean> = {};
const actions: string[] = [];

// ---------- voxels ----------
function TypeMesh({ t, list }: { t: number; list: number[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = list.length / 3;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(list[i * 3] + 0.5, list[i * 3 + 1] + 0.5, list[i * 3 + 2] + 0.5);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.count = count;
    m.instanceMatrix.needsUpdate = true;
  }, [list, count]);
  return (
    <instancedMesh
      ref={ref}
      args={[boxGeo, getBlockMaterials()[t], Math.max(count, 1)]}
      frustumCulled={false}
      castShadow
      receiveShadow
    />
  );
}

function Voxels() {
  const version = useHud((s) => s.version);
  const groups = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const t of BLOCK_TYPES) m.set(t, []);
    for (const [k, t] of G.world.blocks) {
      const [x, y, z] = k.split(",").map(Number);
      m.get(t)!.push(x, y, z);
    }
    return m;
  }, [version]);
  return (
    <>
      {BLOCK_TYPES.map((t) => (
        <TypeMesh key={`${t}-${version}`} t={t} list={groups.get(t)!} />
      ))}
    </>
  );
}

// ---------- chests ----------
function Chests() {
  useHud((s) => s.opened);
  const mats = getChestMaterials();
  return (
    <>
      {CHESTS.map((c) => {
        const open = G.opened.has(c.id);
        return (
          <group key={c.id} position={[c.x + 0.5, c.y, c.z + 0.5]}>
            <mesh position={[0, 0.32, 0]} material={mats} castShadow receiveShadow scale={[0.86, 0.64, 0.86]}>
              <boxGeometry />
            </mesh>
            <mesh
              position={[0, open ? 0.85 : 0.72, open ? -0.3 : 0]}
              rotation-x={open ? -1.1 : 0}
              material={mats}
              castShadow
              scale={[0.9, 0.18, 0.9]}
            >
              <boxGeometry />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ---------- remote players ----------
const PALETTE = ["#e05a47", "#3f8fd8", "#f2b632", "#5bbf5a", "#b764d6", "#ef8a3c", "#45c2b8", "#e46fa5"];
const colorFor = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
};

const tmp = new THREE.Vector3();

function Avatar({ id, name }: { id: string; name: string }) {
  const g = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  const color = colorFor(id);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = G.remotes.get(id);
    const grp = g.current;
    if (!grp) return;
    if (!s || !s.alive) {
      grp.visible = false;
      return;
    }
    grp.visible = true;
    tmp.set(s.x, s.y, s.z);
    const before = grp.position.clone();
    const t = 1 - Math.exp(-12 * dt);
    if (grp.position.distanceTo(tmp) > 6) grp.position.copy(tmp);
    else grp.position.lerp(tmp, t);
    const dy = s.ry - grp.rotation.y;
    grp.rotation.y += Math.atan2(Math.sin(dy), Math.cos(dy)) * t;
    const speed = Math.hypot(grp.position.x - before.x, grp.position.z - before.z) / Math.max(dt, 1e-4);
    phase.current += dt * Math.min(speed, 8) * 2.2;
    const sw = Math.sin(phase.current) * Math.min(speed / 5, 1) * 0.8;
    if (legL.current) legL.current.rotation.x = sw;
    if (legR.current) legR.current.rotation.x = -sw;
    if (armL.current) armL.current.rotation.x = -sw;
    if (armR.current) armR.current.rotation.x = sw;
  });

  return (
    <group ref={g} visible={false}>
      <group position={[0, 0.75, 0]}>
        <mesh ref={legL} position={[-0.13, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 0.75, 0.25]} />
          <meshStandardMaterial color="#2d3a5c" roughness={0.9} />
        </mesh>
        <mesh ref={legR} position={[0.13, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 0.75, 0.25]} />
          <meshStandardMaterial color="#2d3a5c" roughness={0.9} />
        </mesh>
      </group>
      <mesh position={[0, 1.12, 0]} castShadow>
        <boxGeometry args={[0.52, 0.75, 0.28]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <group position={[0, 1.45, 0]}>
        <mesh ref={armL} position={[-0.38, -0.32, 0]} castShadow>
          <boxGeometry args={[0.22, 0.72, 0.22]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh ref={armR} position={[0.38, -0.32, 0]} castShadow>
          <boxGeometry args={[0.22, 0.72, 0.22]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </group>
      <mesh position={[0, 1.76, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#e7b98f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.8, -0.255]}>
        <boxGeometry args={[0.32, 0.08, 0.01]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <Html position={[0, 2.35, 0]} center distanceFactor={10} zIndexRange={[5, 0]}>
        <div className="nametag">{name}</div>
      </Html>
    </group>
  );
}

function Remotes() {
  const roster = useHud((s) => s.roster);
  return (
    <>
      {roster
        .filter((r) => r.id !== playerId)
        .map((r) => (
          <Avatar key={r.id} id={r.id} name={r.name} />
        ))}
    </>
  );
}

// ---------- clouds ----------
function Clouds() {
  const ref = useRef<THREE.Group>(null);
  const clouds = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: Math.cos(i * 2.4) * (30 + (i % 4) * 12),
        z: Math.sin(i * 2.4) * (30 + (i % 3) * 14),
        y: 14 + (i % 5) * 3,
        w: 6 + (i % 4) * 3,
        d: 4 + (i % 3) * 2,
      })),
    [],
  );
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += Math.min(dt, 0.05) * 0.008;
  });
  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]}>
          <boxGeometry args={[c.w, 1.2, c.d]} />
          <meshStandardMaterial color="#ffffff" roughness={1} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- local player ----------
function collides(p: THREE.Vector3) {
  const w = G.world;
  for (let x = Math.floor(p.x - HALF_W); x <= Math.floor(p.x + HALF_W); x++)
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + HEIGHT - 0.01); y++)
      for (let z = Math.floor(p.z - HALF_W); z <= Math.floor(p.z + HALF_W); z++)
        if (w.get(x, y, z)) return true;
  return false;
}

function moveAxis(axis: 0 | 1 | 2, d: number) {
  const p = G.self.pos;
  const steps = Math.max(1, Math.ceil(Math.abs(d) / 0.1));
  const sd = d / steps;
  for (let i = 0; i < steps; i++) {
    p.setComponent(axis, p.getComponent(axis) + sd);
    if (collides(p)) {
      if (axis === 1 && sd < 0) p.y = Math.floor(p.y) + 1;
      else if (axis === 1) p.y = Math.floor(p.y + HEIGHT) - HEIGHT - 0.001;
      else p.setComponent(axis, p.getComponent(axis) - sd);
      return true;
    }
  }
  return false;
}

const look = new THREE.Vector3();
const toTarget = new THREE.Vector3();

function PlayerController() {
  const { camera, gl } = useThree();
  const acc = useRef(0);
  const last = useRef({ x: 0, y: 0, z: 0, ry: 0, a: true, at: -10 });
  const cooldown = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => {
      if (!document.pointerLockElement) el.requestPointerLock?.();
    };
    const onLock = () => hud.set({ locked: document.pointerLockElement === el });
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      G.self.yaw -= e.movementX * 0.0022;
      G.self.pitch = Math.max(-1.55, Math.min(1.55, G.self.pitch - e.movementY * 0.0022));
    };
    const onDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      actions.push(e.button === 2 ? "place" : "attack");
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      keys[e.code] = true;
      if (e.code === "Space") e.preventDefault();
      if (e.code === "KeyE") actions.push("chest");
      if (e.code === "Enter") startRound();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    const noMenu = (e: Event) => e.preventDefault();
    const onBlur = () => Object.keys(keys).forEach((k) => (keys[k] = false));
    el.addEventListener("click", onClick);
    el.addEventListener("contextmenu", noMenu);
    document.addEventListener("pointerlockchange", onLock);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("click", onClick);
      el.removeEventListener("contextmenu", noMenu);
      document.removeEventListener("pointerlockchange", onLock);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [gl]);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const me = G.self;
    const fwdIn = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const rightIn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    let wx = -sy * fwdIn + cy * rightIn;
    let wz = -cy * fwdIn - sy * rightIn;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }

    if (me.spectator) {
      const sp = 12;
      me.pos.x += wx * sp * dt;
      me.pos.z += wz * sp * dt;
      me.pos.y += ((keys.Space ? 1 : 0) - (keys.ShiftLeft ? 1 : 0)) * sp * dt;
    } else {
      const sprint = keys.ShiftLeft || keys.ControlLeft ? 1.3 : 1;
      const k = 1 - Math.exp(-(me.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt);
      me.vel.x += (wx * SPEED * sprint - me.vel.x) * k;
      me.vel.z += (wz * SPEED * sprint - me.vel.z) * k;
      me.kb.multiplyScalar(Math.exp(-(me.onGround ? KB_DRAG_GROUND : KB_DRAG_AIR) * dt));
      me.vel.y = Math.max(me.vel.y - GRAVITY * dt, -30);
      if (keys.Space && me.onGround) me.vel.y = JUMP;

      if (moveAxis(0, (me.vel.x + me.kb.x) * dt)) { me.vel.x = 0; me.kb.x = 0; }
      if (moveAxis(2, (me.vel.z + me.kb.y) * dt)) { me.vel.z = 0; me.kb.y = 0; }
      me.onGround = false;
      if (moveAxis(1, me.vel.y * dt)) {
        if (me.vel.y < 0) me.onGround = true;
        me.vel.y = 0;
      }

      if (me.pos.y < -25) {
        if (G.phase === "playing" && G.alive.has(playerId)) die();
        else teleportToSpawn(Math.max(0, G.spawnIdx));
      }
    }

    camera.position.set(me.pos.x, me.pos.y + EYE, me.pos.z);
    camera.rotation.set(me.pitch, me.yaw, 0, "YXZ");

    // actions
    cooldown.current -= dt;
    while (actions.length) {
      const a = actions.shift()!;
      const canAct = G.phase === "playing" && !me.spectator;
      if (!canAct) continue;
      camera.getWorldDirection(look);
      if (a === "attack") {
        if (cooldown.current > 0) continue;
        cooldown.current = 0.35;
        let best: string | null = null;
        let bestD = Infinity;
        for (const [id, s] of G.remotes) {
          if (!s.alive || !G.alive.has(id)) continue;
          toTarget.set(s.x - camera.position.x, s.y + 1 - camera.position.y, s.z - camera.position.z);
          const d = toTarget.length();
          if (d > REACH || d >= bestD) continue;
          if (toTarget.normalize().dot(look) < 0.82) continue;
          best = id;
          bestD = d;
        }
        if (best) {
          const hl = Math.hypot(look.x, look.z) || 1;
          send("hit", { from: playerId, target: best, dx: look.x / hl, dz: look.z / hl, power: SWORD_POWER[me.sword] });
          hud.set({ hurt: hud.get().hurt }); // no-op keeps typing simple
        } else {
          const hit = raycast(G.world, camera.position, look, 5);
          if (hit) {
            applyBlock(hit.x, hit.y, hit.z, 0, true);
            me.blocks += 1;
            hud.set({ blocks: me.blocks });
          }
        }
      } else if (a === "place") {
        if (me.blocks <= 0) continue;
        const hit = raycast(G.world, camera.position, look, 5);
        if (!hit) continue;
        const x = hit.x + hit.n[0], y = hit.y + hit.n[1], z = hit.z + hit.n[2];
        G.world.set(x, y, z, BLOCK.WOOL);
        const blocked = collides(me.pos);
        G.world.set(x, y, z, 0);
        if (blocked || y > 30) continue;
        applyBlock(x, y, z, BLOCK.WOOL, true);
        me.blocks -= 1;
        hud.set({ blocks: me.blocks });
      } else if (a === "chest") {
        const c = CHESTS.find(
          (c) => !G.opened.has(c.id) && Math.hypot(c.x + 0.5 - me.pos.x, c.y - me.pos.y, c.z + 0.5 - me.pos.z) < 3.2,
        );
        if (!c) continue;
        openChest(c.id, true);
        const gain = 12 + Math.floor(Math.random() * 17);
        me.blocks += gain;
        let msg = `Chest: +${gain} blocks`;
        if (me.sword < 3 && Math.random() < 0.6) {
          me.sword += 1;
          msg += ` · ${SWORDS[me.sword]}!`;
        }
        hud.set({ blocks: me.blocks, sword: me.sword });
        pushFeed(msg);
      }
    }

    // network
    acc.current += dt;
    if (acc.current >= NET_TICK && !document.hidden) {
      acc.current = 0;
      const x = Math.round(me.pos.x * 100) / 100;
      const y = Math.round(me.pos.y * 100) / 100;
      const z = Math.round(me.pos.z * 100) / 100;
      const ry = Math.round(me.yaw * 100) / 100;
      const a = !me.spectator;
      const l = last.current;
      const moved = Math.abs(x - l.x) + Math.abs(y - l.y) + Math.abs(z - l.z) + Math.abs(ry - l.ry) > 0.01 || a !== l.a;
      const stale = clock.elapsedTime - l.at > 1;
      if (moved || stale) {
        last.current = { x, y, z, ry, a, at: clock.elapsedTime };
        send("state", { id: playerId, name: G.name, x, y, z, ry, alive: a });
      }
    }

    hostTick();
  });

  return null;
}

export function Scene() {
  return (
    <>
      <Voxels />
      <Chests />
      <Remotes />
      <Clouds />
      <PlayerController />
    </>
  );
}
