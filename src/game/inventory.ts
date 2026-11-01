import { addItem, def, type Slot } from "./items";
import { meleeDamage } from "./combat";

/** Move the whole stack, retaining anything that does not fit. */
export function transferStack(source: Slot[], index: number, destination: Slot[]) {
  const item = source[index];
  if (!item || source === destination) return false;
  const left = addItem(destination, item.id, item.n);
  if (left === item.n) return false;
  source[index] = left ? { id: item.id, n: left } : null;
  return true;
}

/** Armor takes priority over chest transfers; swap the previously worn piece back. */
export function quickEquip(source: Slot[], index: number, armor: Slot[]) {
  const item = source[index];
  if (!item || item.n !== 1) return false;
  const piece = def(item.id).armor;
  if (!piece) return false;
  source[index] = armor[piece.part] ?? null;
  armor[piece.part] = { ...item };
  return true;
}

export function itemDescription(id: string) {
  const item = def(id);
  if (item.armor) return `${item.armor.points} armor points · ${item.armor.points * 3}% damage protection`;
  if (id.endsWith("_sword")) return `${meleeDamage(id)} melee damage`;
  if (id === "bow") return "Charged ranged weapon · uses arrows · 2–8 damage";
  if (id === "arrow") return "Ammunition for bows";
  if (item.heal) return `Restores ${item.heal / 2} hearts`;
  if (item.block) return "Building block · stack of up to 64";
  return item.name;
}