// Shared pixel silhouettes for inventory art and held voxel swords.
export const SWORD_TIERS = ["wood", "stone", "iron", "diamond"] as const;
export type SwordTier = typeof SWORD_TIERS[number];
// b = blade, e = edge, g = guard, h = grip, j = jewel / pommel.
export const SWORD_PIXELS: Record<SwordTier, string[]> = {
  wood: ["     bb     ", "     be     ", "     be     ", "     be     ", "     be     ", "     be     ", "     be     ", "     be     ", "     be     ", "    bbe     ", "   gggggg   ", "     hh     ", "     hh     ", "     hh     ", "     gg     "],
  stone: ["     ee     ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "  gggggggg  ", "  gg hh gg  ", "     hh     ", "     hh     ", "    gggg    "],
  iron: ["      e     ", "     be     ", "     be     ", "     be     ", "     be     ", "     be     ", "     be     ", "     be     ", "     be     ", "     be     ", "  g  be  g  ", "  gggggggg  ", "     hh     ", "     gh     ", "     hh     ", "     gg     "],
  diamond: ["     ee     ", "    ebbe    ", "   ebbbbe   ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "    ebbe    ", "   ebbbbe   ", "   ebbbbe   ", " ggggjjgggg ", " gg  jj  gg ", "     hh     ", "     gh     ", "     hh     ", "     jj     "],
};
export function swordAppearance(id?: string | null): SwordTier | null {
  return SWORD_TIERS.find((tier) => id === `${tier}_sword`) ?? null;
}