import { armorReduction, type Slot } from "./items";

export const MAX_HEALTH = 20;
export const KNOCKBACK_SCALE = 0.5;
export const HIT_LIFT = 6.5 * KNOCKBACK_SCALE;
export const FIST_DAMAGE = 1;
export const SWORD_DAMAGE: Record<string, number> = {
  wood_sword: 4, stone_sword: 5, iron_sword: 6, diamond_sword: 7,
};

export function damageAfterArmor(damage: number, armor: Slot[]) {
  return Math.max(0, damage) * (1 - armorReduction(armor));
}

export function healthAfterHit(health: number, damage: number, armor: Slot[]) {
  return Math.max(0, health - damageAfterArmor(damage, armor));
}

export function knockbackAfterArmor(power: number, armor: Slot[]) {
  return power * KNOCKBACK_SCALE * (1 - armorReduction(armor));
}

export function meleeDamage(itemId?: string) {
  return (itemId && SWORD_DAMAGE[itemId]) || FIST_DAMAGE;
}

export function arrowDamage(speed: number) {
  return Math.min(8, Math.max(2, speed * 0.24));
}