import { useEffect, useId, useState, type MouseEvent as ReactMouseEvent } from "react";
import { G, getChest, invChanged, setChestSlot } from "@/game/engine";
import { def, type Slot } from "@/game/items";
import { useHud } from "@/game/store";
import { Button } from "@/components/ui/button";
import { itemDescription, quickEquip, transferStack } from "@/game/inventory";

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
  const worn = G.self.armor[part] ?? null;
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
  label,
}: {
  item: Slot;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  ghost?: string;
  label: string;
}) {
  const descriptionId = useId();
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="inv-slot group rounded-none p-0"
      aria-label={`${label}: ${item ? `${def(item.id).name} (${item.n})` : "Empty"}`}
      aria-describedby={item ? descriptionId : undefined}
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
      {item && (
        <span id={descriptionId} role="tooltip" className="item-tooltip pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-52 -translate-x-1/2 whitespace-normal border-2 border-primary bg-popover p-2 text-left text-xs text-popover-foreground group-hover:block group-focus-visible:block">
          <span className="mb-1 block text-sm text-primary">{def(item.id).name}</span>
          {itemDescription(item.id)}
        </span>
      )}
    </Button>
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

  const quickMove = (source: Slot[], index: number) => {
    if (G.ui.cursor) return;
    const equipped = quickEquip(source, index, me.armor);
    let moved = equipped;
    if (!equipped) {
      if (source === chest) moved = transferStack(source, index, me.inv);
      else if (chest) moved = transferStack(source, index, chest);
      else {
        const destination = index < 9 ? me.inv.slice(9) : me.inv.slice(0, 9);
        moved = transferStack(source, index, destination);
        if (moved) me.inv.splice(index < 9 ? 9 : 0, destination.length, ...destination);
      }
    }
    if (!moved) return;
    if (chest && chestId !== null) {
      if (source === chest) setChestSlot(chestId, index, chest[index] ?? null, true);
      else if (!equipped) chest.forEach((item, slot) => setChestSlot(chestId, slot, item, true));
    }
    invChanged();
  };

  const invSlot = (i: number) => (
    <SlotButton
      key={i}
      item={me.inv[i] ?? null}
      label={`Inventory slot ${i + 1}`}
      onClick={(event) => event.shiftKey ? quickMove(me.inv, i) :
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
      <div className="pixel-panel max-w-full p-4">
        {chest && (
          <>
            <div className="mb-2 text-sm text-primary">Chest</div>
            <div className="grid grid-cols-9 gap-1">
              {chest.map((it, i) => (
                <SlotButton
                  key={i}
                  item={it}
                  label={`Chest slot ${i + 1}`}
                  onClick={(event) => event.shiftKey ? quickMove(chest, i) :
                    clickSlot(
                      () => chest[i] ?? null,
                      (s) => { if (chestId !== null) setChestSlot(chestId, i, s, true); },
                    )
                  }
                />
              ))}
            </div>
            <div className="my-3 border-t-2 border-border" />
          </>
        )}

        {(
          <div className="mb-3 flex items-start gap-3">
            <div className="flex flex-col gap-1">
              {ARMOR_GHOST.map((g, part) => (
                <SlotButton
                  key={part}
                  item={me.armor[part] ?? null}
                  ghost={g}
                  label={`Equipped ${ARMOR_NAME[part]}`}
                  onClick={(event) => {
                    if (event.shiftKey) {
                      if (!G.ui.cursor && transferStack(me.armor, part, me.inv)) invChanged();
                    } else clickArmor(part);
                  }}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              <div className="mb-1 text-sm text-primary">Armor</div>
              {ARMOR_NAME.map((n, i) => (
                <div key={n} className={me.armor[i] ? "text-foreground" : ""}>
                  {n}: {def(me.armor[i]?.id ?? "")?.name ?? "—"}
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
