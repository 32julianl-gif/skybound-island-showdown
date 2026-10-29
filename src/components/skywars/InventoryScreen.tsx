import { useEffect, useState } from "react";
import { G, getChest, invChanged, setChestSlot } from "@/game/engine";
import { def, type Slot } from "@/game/items";
import { useHud } from "@/game/store";

/** Minecraft-style click: pick up / place / merge / swap with the cursor stack. */
function clickSlot(get: () => Slot, set: (s: Slot) => void) {
  const cur = G.ui.cursor;
  const s = get();
  if (!cur && !s) return;
  if (!cur) {
    set(null);
    G.ui.cursor = s;
  } else if (!s) {
    set({ ...cur });
    G.ui.cursor = null;
  } else if (s.id === cur.id && s.n < def(s.id).stack) {
    const k = Math.min(def(s.id).stack - s.n, cur.n);
    set({ id: s.id, n: s.n + k });
    cur.n -= k;
    if (cur.n <= 0) G.ui.cursor = null;
  } else {
    set({ ...cur });
    G.ui.cursor = s;
  }
  invChanged();
}

function clickArmor(part: number) {
  const cur = G.ui.cursor;
  const worn = G.self.armor[part];
  if (cur) {
    const a = def(cur.id).armor;
    if (!a || a.part !== part) return; // only the matching piece fits
    G.self.armor[part] = { ...cur };
    G.ui.cursor = worn;
  } else if (worn) {
    G.ui.cursor = worn;
    G.self.armor[part] = null;
  } else return;
  invChanged();
}

function SlotButton({
  item,
  onClick,
  ghost,
}: {
  item: Slot;
  onClick: () => void;
  ghost?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inv-slot"
      title={item ? def(item.id).name : undefined}
    >
      {item ? (
        <>
          <span className="text-xl leading-none">{def(item.id).icon}</span>
          {item.n > 1 && (
            <span className="absolute bottom-0 right-0.5 text-xs text-shadow-pixel">{item.n}</span>
          )}
        </>
      ) : (
        ghost && <span className="text-lg leading-none opacity-25">{ghost}</span>
      )}
    </button>
  );
}

const ARMOR_GHOST = ["🪖", "🦺", "👖", "🥾"];
const ARMOR_NAME = ["Helmet", "Chestplate", "Leggings", "Boots"];

export function InventoryScreen() {
  const ui = useHud((s) => s.ui);
  useHud((s) => s.invV);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (ui === null) return;
    const onMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [ui]);

  if (ui === null) return null;

  const me = G.self;
  const chestId = typeof ui === "number" ? ui : null;
  const chest = chestId !== null ? getChest(chestId) : null;
  const cursor = G.ui.cursor;

  const invSlot = (i: number) => (
    <SlotButton
      key={i}
      item={me.inv[i] ?? null}
      onClick={() =>
        clickSlot(
          () => me.inv[i] ?? null,
          (s) => {
            me.inv[i] = s;
          },
        )
      }
    />
  );

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center font-pixel">
      <div className="pixel-panel p-4">
        {chest && (
          <>
            <div className="mb-2 text-sm text-primary">Chest</div>
            <div className="grid grid-cols-9 gap-1">
              {chest.map((it, i) => (
                <SlotButton
                  key={i}
                  item={it}
                  onClick={() =>
                    clickSlot(
                      () => chest[i] ?? null,
                      (s) => setChestSlot(chestId!, i, s, true),
                    )
                  }
                />
              ))}
            </div>
            <div className="my-3 border-t-2 border-border" />
          </>
        )}

        {chest === null && (
          <div className="mb-3 flex items-start gap-3">
            <div className="flex flex-col gap-1">
              {ARMOR_GHOST.map((g, part) => (
                <SlotButton
                  key={part}
                  item={me.armor[part] ?? null}
                  ghost={g}
                  onClick={() => clickArmor(part)}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              <div className="mb-1 text-sm text-primary">Armor</div>
              {ARMOR_NAME.map((n, i) => (
                <div key={n} className={me.armor[i] ? "text-foreground" : ""}>
                  {n}: {me.armor[i] ? def(me.armor[i]!.id).name : "—"}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-2 text-sm text-primary">Inventory</div>
        <div className="grid grid-cols-9 gap-1">
          {Array.from({ length: 27 }, (_, k) => invSlot(k + 9))}
        </div>
        <div className="mt-2 grid grid-cols-9 gap-1">
          {Array.from({ length: 9 }, (_, k) => invSlot(k))}
        </div>
        <div className="mt-2 text-center text-xs text-muted-foreground">
          Click to pick up / place · E or Esc to close
        </div>
      </div>

      {/* stack held on the cursor */}
      {cursor && (
        <div
          className="pointer-events-none fixed z-30 flex items-center gap-1"
          style={{ left: mouse.x + 10, top: mouse.y + 8 }}
        >
          <span className="text-2xl text-shadow-pixel">{def(cursor.id).icon}</span>
          {cursor.n > 1 && <span className="text-sm text-shadow-pixel">{cursor.n}</span>}
        </div>
      )}
    </div>
  );
}
