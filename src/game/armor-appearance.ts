export const ARMOR_TIERS = ["leather", "iron", "diamond"] as const;
export type ArmorTier = typeof ARMOR_TIERS[number];
export function armorAppearance(id: string | null | undefined) {
  const [tier, part] = (id ?? "").split("_");
  if (!ARMOR_TIERS.some((value) => value === tier) || !["helmet", "chestplate", "leggings", "boots"].includes(part ?? "")) return null;
  return { tier: tier as ArmorTier, part };
}