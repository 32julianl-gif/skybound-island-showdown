import { useEffect, useState } from "react";
import { useHud } from "@/game/store";
import { G, startRound } from "@/game/engine";
import { lockPointer } from "./Scene";
import { def } from "@/game/items";
import { playerId } from "@/game/net";
import { MAX_HEALTH } from "@/game/combat";

export function Hud({ room }: { room: string }) {
  const phase = useHud((s) => s.phase);
  const roster = useHud((s) => s.roster);
  const aliveIds = useHud((s) => s.aliveIds);
  const isHost = useHud((s) => s.isHost);
  useHud((s) => s.invV);
  const mapName = useHud((s) => s.mapName);
  const feed = useHud((s) => s.feed);
  const winner = useHud((s) => s.winner);
  const locked = useHud((s) => s.locked);
  const hurt = useHud((s) => s.hurt);
  const spectator = useHud((s) => s.spectator);
  const connected = useHud((s) => s.connected);
  const uiOpen = useHud((s) => s.ui) !== null;
  const chatOpen = useHud((s) => s.chatOpen);
  const health = useHud((s) => s.health);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!hurt) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 250);
    return () => clearTimeout(t);
  }, [hurt]);

  const copy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-pixel text-foreground">
      {flash && <div className="hurt-vignette absolute inset-0" />}

      {/* crosshair */}
      {!uiOpen && !chatOpen && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl leading-none text-shadow-pixel">
          +
        </div>
      )}

      {/* top-left: room + players */}
      <div className="pixel-panel absolute left-4 top-4 min-w-52 p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">ROOM</span>
          <span className="text-primary">{room}</span>
        </div>
        <div className="text-xs text-muted-foreground">Map: {mapName}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {connected ? `${roster.length}/8 players` : "Connecting…"}
        </div>
        <ul className="mt-2 space-y-0.5">
          {roster.map((r) => {
            const out = phase !== "waiting" && !aliveIds.includes(r.id);
            return (
              <li key={r.id} className={out ? "text-muted-foreground line-through" : ""}>
                {r.name}
                {r.id === playerId ? " (you)" : ""}
              </li>
            );
          })}
        </ul>
        <button onClick={copy} className="pixel-btn pixel-btn-ghost pointer-events-auto mt-3 w-full text-xs">
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
      </div>

      {/* feed */}
      <div className="absolute right-4 top-4 flex max-w-sm flex-col items-end gap-1">
        {feed.map((f) => (
          <div key={f.id} className="pixel-panel px-3 py-1 text-sm">
            {f.text}
          </div>
        ))}
      </div>

      {/* center banners */}
      {phase === "waiting" && (
        <div className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center">
          <div className="text-3xl text-primary text-shadow-pixel">WAITING FOR PLAYERS</div>
          {isHost ? (
            <button onClick={startRound} className="pixel-btn pixel-btn-primary pointer-events-auto mt-4">
              Start round (Enter)
            </button>
          ) : (
            <div className="mt-2 text-sm text-shadow-pixel">The host will start the round</div>
          )}
        </div>
      )}
      {phase === "ended" && (
        <div className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center">
          <div className="text-5xl text-primary text-shadow-pixel">{winner ? `${winner} WINS!` : "ROUND OVER"}</div>
          <div className="mt-2 text-sm text-shadow-pixel">New round soon…</div>
        </div>
      )}
      {phase === "playing" && spectator && (
        <div className="absolute left-1/2 top-[14%] -translate-x-1/2 text-center text-lg text-shadow-pixel">
          SPECTATING · WASD + Space/Shift to fly
        </div>
      )}

      {/* hotbar */}
      {!spectator && phase === "playing" && !uiOpen && (
        <div role="meter" aria-label="Health" aria-valuemin={0} aria-valuemax={MAX_HEALTH} aria-valuenow={health} className="pixel-panel absolute bottom-20 left-1/2 -translate-x-1/2 px-3 py-2 text-center">
          <div className="flex gap-1 text-lg leading-none" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => <span key={i} className={health > i * 2 ? "text-destructive" : "text-muted-foreground opacity-40"}>♥</span>)}
          </div>
          <div className="mt-1 text-xs">{Math.ceil(health * 10) / 10} / {MAX_HEALTH} HP</div>
        </div>
      )}
      {!spectator && !uiOpen && (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
          {G.self.inv.slice(0, 9).map((it, i) => (
            <div key={i} className="pixel-slot" style={i === G.self.sel ? { borderColor: "var(--primary)" } : undefined}>
              <span>{it ? def(it.id).icon : ""}</span>
              <span className="text-xs">{it && it.n > 1 ? it.n : ""}</span>
            </div>
          ))}
        </div>
      )}

      {/* Esc menu: controls + resume */}
      {!locked && !uiOpen && !chatOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <div className="pixel-panel w-full max-w-md p-5 text-center text-sm">
            <div className="mb-3 text-2xl text-primary text-shadow-pixel">MENU</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-left text-xs">
              <span className="text-muted-foreground">WASD</span><span>Move</span>
              <span className="text-muted-foreground">Space</span><span>Jump</span>
              <span className="text-muted-foreground">Shift</span><span>Sprint</span>
              <span className="text-muted-foreground">C</span><span>Crouch (safe bridging)</span>
              <span className="text-muted-foreground">Left click</span><span>Hit player / break block</span>
              <span className="text-muted-foreground">Right click</span><span>Place block / shoot bow</span>
              <span className="text-muted-foreground">E</span><span>Inventory / open chest</span>
              <span className="text-muted-foreground">1–9 / wheel</span><span>Pick hotbar slot</span>
              <span className="text-muted-foreground">Esc</span><span>This menu</span>
              <span className="text-muted-foreground">T</span><span>Room chat</span>
            </div>
            <button onClick={lockPointer} className="pixel-btn pixel-btn-primary pointer-events-auto mt-4 w-full">
              Resume (click)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
