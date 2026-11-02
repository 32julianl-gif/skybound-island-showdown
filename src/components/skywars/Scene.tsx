import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BLOCK_TYPES, mapDef, raycast } from "@/game/world";
import { getBlockMaterials, getChestMaterials } from "@/game/textures";
import { G, applyBlock, closeUi, die, eatHeldFood, tickHealth, hostTick, invChanged, refreshRoster, openChat, openChest, startRound, teleportToSpawn } from "@/game/engine";
import { hud, pushFeed, useHud } from "@/game/store";
import { addItem, BREAK_TIME, countItem, def, FIST_POWER, removeItem } from "@/game/items";
import { playerId, send } from "@/game/net";
import { arrowDamage, meleeDamage, MAX_HEALTH } from "@/game/combat";
import { surfaceGeometry } from "@/game/voxel-geometry";

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
const CROUCH_HEIGHT = 1.5;
const CROUCH_MULT = 0.3;
const SPRINT_MULT = 1.3;
const SPRINT_JUMP_BOOST = 2.2;
const ARROW_GRAVITY = 14;

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// ---------- input (module-level, read in frame loop) ----------
const keys = new Set<string>();
const actions: string[] = [];

// ---------- voxels ----------
function Voxels() {
  const version = useHud((s) => s.version);
  const groups = useMemo(() => surfaceGeometry(G.world), [version]);
  useEffect(() => () => { for (const geometry of groups.values()) geometry.dispose(); }, [groups]);
  return (
    <>
      {BLOCK_TYPES.map((t) => {
        const geometry = groups.get(t);
        if (!geometry || geometry.getAttribute("position").count === 0) return null;
        return <mesh key={t} geometry={geometry} material={getBlockMaterials()[t]} castShadow receiveShadow />;
      })}
    </>
  );
}

// ---------- chests ----------
function Chests() {
  useHud((s) => s.opened);
  useHud((s) => s.version);
  const CHESTS = mapDef(G.map).chests;
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
  return PALETTE[Math.abs(h) % PALETTE.length]!;
};

const tmp = new THREE.Vector3();

function Avatar({ id, name }: { id: string; name: string }) {
  const g = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  const healthMeter = useRef<HTMLMeterElement>(null);
  const healthText = useRef<HTMLSpanElement>(null);
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
    const hp = Math.max(0, Math.min(MAX_HEALTH, Number.isFinite(s.hp) ? s.hp ?? MAX_HEALTH : MAX_HEALTH));
    if (healthMeter.current && healthMeter.current.value !== hp) healthMeter.current.value = hp;
    if (healthText.current) healthText.current.textContent = `${Math.ceil(hp * 10) / 10} / ${MAX_HEALTH}`;
    grp.scale.y += ((s.c ? 0.82 : 1) - grp.scale.y) * 0.3;
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
        <div className="nametag pointer-events-none flex min-w-24 flex-col items-center gap-1">
          <span>{name}</span>
          <meter ref={healthMeter} className="player-health" aria-label={`${name} health`} min={0} max={MAX_HEALTH} value={MAX_HEALTH} />
          <span ref={healthText} className="text-xs">{MAX_HEALTH} / {MAX_HEALTH}</span>
        </div>
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

// ---------- arrows ----------
const ARROW_POOL = 24;
function Arrows() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const now = performance.now();
    G.arrows = G.arrows.filter((a) => a.stuck < 0 || now - a.stuck < 3000);
    for (const a of G.arrows) {
      if (a.stuck >= 0) continue;
      a.v.y -= ARROW_GRAVITY * dt;
      const next = a.p.clone().addScaledVector(a.v, dt);
      if (G.world.get(Math.floor(next.x), Math.floor(next.y), Math.floor(next.z)) || next.y < -40) {
        a.stuck = now;
        continue;
      }
      // only the shooter decides hits
      if (a.from === playerId) {
        for (const [id, r] of G.remotes) {
          if (!r.alive || !G.alive.has(id)) continue;
          if (Math.abs(next.x - r.x) < 0.45 && Math.abs(next.z - r.z) < 0.45 && next.y > r.y && next.y < r.y + 1.9) {
            const hl = Math.hypot(a.v.x, a.v.z) || 1;
            const power = Math.min(14, a.v.length() * 0.45);
            send("hit", { from: playerId, target: id, dx: a.v.x / hl, dz: a.v.z / hl, power, damage: arrowDamage(a.v.length()), round: G.round });
            pushFeed(`Arrow hit ${r.name}!`);
            a.stuck = now - 2900;
            break;
          }
        }
      }
      a.p.copy(next);
    }
    for (let i = 0; i < ARROW_POOL; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const a = G.arrows[i];
      g.visible = !!a && now - a.stuck > 0;
      if (!a) continue;
      g.position.copy(a.p);
      if (a.stuck < 0) g.lookAt(tmp.copy(a.p).add(a.v));
    }
  });
  return (
    <>
      {Array.from({ length: ARROW_POOL }, (_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
          <mesh position={[0, 0, -0.3]}>
            <boxGeometry args={[0.05, 0.05, 0.7]} />
            <meshStandardMaterial color="#8a6a3f" />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.1, 0.1, 0.12]} />
            <meshStandardMaterial color="#9aa0a6" />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ---------- block break overlay ----------
const breakState = { x: 0, y: 0, z: 0, t: 0, p: 0, active: false };
function BreakOverlay() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m || !mat.current) return;
    m.visible = breakState.active && breakState.p > 0;
    m.position.set(breakState.x + 0.5, breakState.y + 0.5, breakState.z + 0.5);
    mat.current.opacity = 0.15 + breakState.p * 0.5;
    const sc = 1.002 + (1 - breakState.p) * 0.0;
    m.scale.setScalar(sc);
  });
  return (
    <mesh ref={ref} visible={false}>
      <boxGeometry args={[1.01, 1.01, 1.01]} />
      <meshBasicMaterial ref={mat} color="#000000" transparent opacity={0.3} depthWrite={false} wireframe={false} />
    </mesh>
  );
}

// ---------- local player ----------
function collides(p: THREE.Vector3, h = HEIGHT) {
  const w = G.world;
  for (let x = Math.floor(p.x - HALF_W); x <= Math.floor(p.x + HALF_W); x++)
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + h - 0.01); y++)
      for (let z = Math.floor(p.z - HALF_W); z <= Math.floor(p.z + HALF_W); z++)
        if (w.get(x, y, z)) return true;
  return false;
}

function hasGround(p: THREE.Vector3) {
  const y = Math.floor(p.y - 0.05);
  for (let x = Math.floor(p.x - HALF_W); x <= Math.floor(p.x + HALF_W); x++)
    for (let z = Math.floor(p.z - HALF_W); z <= Math.floor(p.z + HALF_W); z++)
      if (G.world.get(x, y, z)) return true;
  return false;
}

function moveAxis(axis: 0 | 1 | 2, d: number, edgeGuard = false) {
  const p = G.self.pos;
  const h = G.self.crouch ? CROUCH_HEIGHT : HEIGHT;
  const steps = Math.max(1, Math.ceil(Math.abs(d) / 0.1));
  const sd = d / steps;
  for (let i = 0; i < steps; i++) {
    p.setComponent(axis, p.getComponent(axis) + sd);
    if (collides(p, h) || (edgeGuard && !hasGround(p))) {
      if (axis === 1 && sd < 0) p.y = Math.floor(p.y) + 1;
      else if (axis === 1) p.y = Math.floor(p.y + h) - h - 0.001;
      else p.setComponent(axis, p.getComponent(axis) - sd);
      return true;
    }
  }
  return false;
}

const look = new THREE.Vector3();
const toTarget = new THREE.Vector3();
let arrowSeq = 0;

export function heldItem() {
  return G.self.inv[G.self.sel] ?? null;
}

export function lockPointer() {
  if (hud.get().chatOpen) return;
  const c = document.querySelector("canvas");
  c?.requestPointerLock?.();
}

export function toggleUi(target: "inv" | number | null) {
  if (target === null || G.ui.open !== null) {
    closeUi();
    lockPointer();
    return;
  }
  G.ui.open = target;
  if (typeof target === "number") openChest(target, true);
  hud.set({ ui: target });
  document.exitPointerLock?.();
}

function PlayerController() {
  const { camera, gl } = useThree();
  const acc = useRef(0);
  const last = useRef({ x: 0, y: 0, z: 0, ry: 0, a: true, c: false, at: -10 });
  const cooldown = useRef(0);
  const rosterAcc = useRef(0);
  const mouse = useRef({ left: false, right: false, rightAt: 0 });
  const lastW = useRef(0);
  const sprinting = useRef(false);

  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => {
      if (!document.pointerLockElement && G.ui.open === null && !hud.get().chatOpen) el.requestPointerLock?.();
    };
    const onLock = () => {
      const locked = document.pointerLockElement === el;
      if (!locked) { mouse.current.left = false; mouse.current.right = false; keys.clear(); }
      hud.set({ locked });
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el || hud.get().chatOpen) return;
      G.self.yaw -= e.movementX * 0.0022;
      G.self.pitch = Math.max(-1.55, Math.min(1.55, G.self.pitch - e.movementY * 0.0022));
    };
    const onDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== el || hud.get().chatOpen) return;
      if (e.button === 0) { mouse.current.left = true; actions.push("attack"); }
      if (e.button === 2) {
        mouse.current.right = true;
        mouse.current.rightAt = performance.now();
        actions.push("use");
      }
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) mouse.current.left = false;
      if (e.button === 2 && mouse.current.right) { mouse.current.right = false; actions.push("release"); }
    };
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== el || hud.get().chatOpen) return;
      G.self.sel = (G.self.sel + (e.deltaY > 0 ? 1 : 8)) % 9;
      invChanged();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable=true]")) return;
      if (hud.get().chatOpen) return;
      if (e.code === "KeyT" && !e.repeat) {
        e.preventDefault();
        keys.clear(); actions.length = 0;
        mouse.current.left = false; mouse.current.right = false;
        sprinting.current = false;
        openChat();
        return;
      }
      if (e.code === "KeyE" || (e.code === "Escape" && G.ui.open !== null)) {
        actions.push("ui");
        return;
      }
      if (G.ui.open !== null) return;
      if (e.code === "KeyW" && !e.repeat) {
        const now = performance.now();
        if (now - lastW.current < 280) sprinting.current = true;
        lastW.current = now;
      }
      keys.add(e.code);
      if (e.code === "Space") e.preventDefault();
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) { G.self.sel = n - 1; invChanged(); }
      }
      if (e.code === "Enter") startRound();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };
    const noMenu = (e: Event) => e.preventDefault();
    const onBlur = () => keys.clear();
    el.addEventListener("click", onClick);
    el.addEventListener("contextmenu", noMenu);
    document.addEventListener("pointerlockchange", onLock);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("wheel", onWheel);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("click", onClick);
      el.removeEventListener("contextmenu", noMenu);
      document.removeEventListener("pointerlockchange", onLock);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [gl]);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    gl.domElement.parentElement?.setAttribute("data-scene-ready", "1");
    tickHealth();
    if (hud.get().chatOpen) {
      keys.clear(); actions.length = 0;
      mouse.current.left = false; mouse.current.right = false;
      sprinting.current = false;
    }
    const me = G.self;
    const fwdIn = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const rightIn = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    let wx = -sy * fwdIn + cy * rightIn;
    let wz = -cy * fwdIn - sy * rightIn;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }

    if (me.spectator) {
      const sp = 12;
      me.pos.x += wx * sp * dt;
      me.pos.z += wz * sp * dt;
      me.pos.y += ((keys.has("Space") ? 1 : 0) - (keys.has("ShiftLeft") ? 1 : 0)) * sp * dt;
      me.crouch = false;
    } else {
      // crouch (C): slow, lower, can't walk off edges
      const wantCrouch = keys.has("KeyC");
      if (wantCrouch) me.crouch = true;
      else if (me.crouch) {
        me.crouch = false;
        if (collides(me.pos, HEIGHT)) me.crouch = true; // no room to stand
      }
      // sprint: Shift or double-tap W; stops when not moving forward or crouching
      if (keys.has("ShiftLeft") || keys.has("ShiftRight")) sprinting.current = true;
      if (fwdIn <= 0 || me.crouch) sprinting.current = false;
      const speed = SPEED * (me.crouch ? CROUCH_MULT : sprinting.current ? SPRINT_MULT : 1);
      const k = 1 - Math.exp(-(me.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt);
      me.vel.x += (wx * speed - me.vel.x) * k;
      me.vel.z += (wz * speed - me.vel.z) * k;
      me.kb.multiplyScalar(Math.exp(-(me.onGround ? KB_DRAG_GROUND : KB_DRAG_AIR) * dt));
      me.vel.y = Math.max(me.vel.y - GRAVITY * dt, -30);
      if (keys.has("Space") && me.onGround) {
        me.vel.y = JUMP;
        if (sprinting.current) {
          // sprint jump: forward boost carried through the air
          me.vel.x += wx * SPRINT_JUMP_BOOST;
          me.vel.z += wz * SPRINT_JUMP_BOOST;
        }
      }

      const guard = me.crouch && me.onGround;
      if (moveAxis(0, (me.vel.x + me.kb.x) * dt, guard)) { me.vel.x = 0; me.kb.x = 0; }
      if (moveAxis(2, (me.vel.z + me.kb.y) * dt, guard)) { me.vel.z = 0; me.kb.y = 0; }
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

    const eyeTarget = me.crouch ? EYE - 0.3 : EYE;
    eyeY.current += (eyeTarget - eyeY.current) * (1 - Math.exp(-14 * dt));
    camera.position.set(me.pos.x, me.pos.y + eyeY.current, me.pos.z);
    camera.rotation.set(me.pitch, me.yaw, 0, "YXZ");
    const fovT = sprinting.current ? 82 : 75;
    const pc = camera as THREE.PerspectiveCamera;
    if (Math.abs(pc.fov - fovT) > 0.1) { pc.fov += (fovT - pc.fov) * (1 - Math.exp(-8 * dt)); pc.updateProjectionMatrix(); }

    const canAct = G.phase === "playing" && !me.spectator && G.ui.open === null && !hud.get().chatOpen;
    const held = heldItem();
    camera.getWorldDirection(look);

    // actions
    cooldown.current -= dt;
    while (actions.length) {
      const a = actions.shift();
      if (!a) continue;
      if (a === "ui") {
        if (G.ui.open !== null) { toggleUi(null); continue; }
        if (me.spectator) continue;
        const c = mapDef(G.map).chests.find(
          (c) => Math.hypot(c.x + 0.5 - me.pos.x, c.y - me.pos.y, c.z + 0.5 - me.pos.z) < 3.2,
        );
        toggleUi(c && G.phase === "playing" ? c.id : "inv");
        continue;
      }
      if (!canAct) continue;
      if (a === "attack") {
        if (cooldown.current > 0) continue;
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
          cooldown.current = 0.35;
          mouse.current.left = false; // a hit doesn't start mining
          const hl = Math.hypot(look.x, look.z) || 1;
          const power = (held ? def(held.id).power : undefined) ?? FIST_POWER;
          const crit = !me.onGround && me.vel.y < 0 ? 1.25 : sprinting.current ? 1.15 : 1;
          send("hit", { from: playerId, target: best, dx: look.x / hl, dz: look.z / hl, power: power * crit, damage: meleeDamage(held?.id) * crit, round: G.round });
        }
      } else if (a === "use") {
        if (held && def(held.id).heal) { eatHeldFood(); continue; }
        if (held?.id === "bow") continue; // charge handled below
        const bt = held ? def(held.id).block : undefined;
        if (!bt || !held) continue;
        const hit = raycast(G.world, camera.position, look, 5);
        if (!hit) continue;
        const x = hit.x + hit.n[0], y = hit.y + hit.n[1], z = hit.z + hit.n[2];
        G.world.set(x, y, z, bt);
        const blocked = collides(me.pos, me.crouch ? CROUCH_HEIGHT : HEIGHT);
        G.world.set(x, y, z, 0);
        if (blocked || y > 30) continue;
        applyBlock(x, y, z, bt, true);
        held.n -= 1;
        if (held.n <= 0) me.inv[me.sel] = null;
        invChanged();
      } else if (a === "release") {
        if (held?.id !== "bow" || countItem(me.inv, "arrow") <= 0) continue;
        const charge = Math.min(1, (performance.now() - mouse.current.rightAt) / 900);
        if (charge < 0.15) continue;
        removeItem(me.inv, "arrow", 1);
        invChanged();
        const sp = 12 + charge * 22;
        const p0 = camera.position.clone().addScaledVector(look, 0.6);
        const v = look.clone().multiplyScalar(sp);
        const id = ++arrowSeq;
        G.arrows.push({ id, from: playerId, p: p0, v, stuck: -1 });
        send("arrow", { id, from: playerId, x: p0.x, y: p0.y, z: p0.z, vx: v.x, vy: v.y, vz: v.z });
      }
    }

    // bow charge HUD
    const charging = canAct && mouse.current.right && held?.id === "bow";
    const ch = charging ? Math.min(1, (performance.now() - mouse.current.rightAt) / 900) : 0;
    if (Math.abs(ch - hud.get().bowCharge) > 0.05 || (ch === 0 && hud.get().bowCharge !== 0)) hud.set({ bowCharge: ch });

    // timed block breaking (hold left click)
    let bp = 0;
    if (canAct && mouse.current.left) {
      const hit = raycast(G.world, camera.position, look, 5);
      if (hit) {
        const t = G.world.get(hit.x, hit.y, hit.z);
        const same = breakState.active && breakState.x === hit.x && breakState.y === hit.y && breakState.z === hit.z && breakState.t === t;
        if (!same) Object.assign(breakState, { x: hit.x, y: hit.y, z: hit.z, t, p: 0, active: true });
        breakState.p += dt / (BREAK_TIME[t] ?? 1);
        if (breakState.p >= 1) {
          applyBlock(hit.x, hit.y, hit.z, 0, true);
          addItem(me.inv, `b${t}`, 1);
          invChanged();
          breakState.active = false;
          breakState.p = 0;
        }
        bp = breakState.p;
      } else breakState.active = false;
    } else {
      breakState.active = false;
      breakState.p = 0;
    }
    if (Math.abs(bp - hud.get().breakProgress) > 0.04 || (bp === 0 && hud.get().breakProgress !== 0)) hud.set({ breakProgress: bp });

    // network
    acc.current += dt;
    if (acc.current >= NET_TICK && !document.hidden) {
      acc.current = 0;
      const x = Math.round(me.pos.x * 100) / 100;
      const y = Math.round(me.pos.y * 100) / 100;
      const z = Math.round(me.pos.z * 100) / 100;
      const ry = Math.round(me.yaw * 100) / 100;
      const a = !me.spectator;
      const c = me.crouch;
      const l = last.current;
      const moved = Math.abs(x - l.x) + Math.abs(y - l.y) + Math.abs(z - l.z) + Math.abs(ry - l.ry) > 0.01 || a !== l.a || c !== l.c;
      const stale = clock.elapsedTime - l.at > 1;
      if (moved || stale) {
        last.current = { x, y, z, ry, a, c, at: clock.elapsedTime };
        send("state", { id: playerId, name: G.name, x, y, z, ry, alive: a, c, hp: me.health });
      }
    }

    hostTick();
    rosterAcc.current += dt;
    if (rosterAcc.current > 1) {
      rosterAcc.current = 0;
      refreshRoster();
    }
  });

  const eyeY = useRef(EYE);
  return null;
}

export function Scene() {
  return (
    <>
      <Voxels />
      <Chests />
      <Remotes />
      <Clouds />
      <Arrows />
      <BreakOverlay />
      <PlayerController />
    </>
  );
}
