import { armorAppearance } from "@/game/armor-appearance";
import { def } from "@/game/items";

const SILHOUETTES: Record<string, string> = {
  helmet: "M3 3h10v2h2v8h-4v-3H5v3H1V5h2z",
  chestplate: "M3 2h3v3h4V2h3l3 3v4h-3v6H3V9H0V5z",
  leggings: "M3 1h10v14H9V7H7v8H3z",
  boots: "M2 2h4v9h1v4H0v-4h2zm8 0h4v9h2v4H9v-4h1z",
};
export function ItemIcon({ id }: { id: string }) {
  const armor = armorAppearance(id);
  if (armor) return (
    <svg viewBox="0 0 16 16" className={`item-art armor-${armor.tier}`} aria-hidden="true" shapeRendering="crispEdges">
      <path d={SILHOUETTES[armor.part ?? ""]} fill="currentColor" />
      <path d="M3 5h2v2H3zm8 0h2v2h-2zM3 13h2v2H3zm8 0h2v2h-2z" className="armor-item-trim" />
      <path d="M5 3h2v1H5zm6 5h1v3h-1z" className="armor-item-highlight" />
      {armor.tier === "leather" && <path d="M6 8h4v2H6z" className="armor-item-trim" />}
      {armor.tier === "diamond" && <path d="m8 5 2 2-2 2-2-2z" className="armor-item-highlight" />}
    </svg>
  );
  if (id === "apple" || id === "bread") return (
    <svg viewBox="0 0 16 16" className="item-art" aria-hidden="true" shapeRendering="crispEdges">
      {id === "apple" ? <><path d="M3 5h10v2h2v6h-2v2H3v-2H1V7h2z" className="food-apple" /><path d="M7 1h2v4H7zm2 0h4v2H9z" className="food-leaf" /><path d="M3 7h2v4H3z" className="armor-item-highlight" /></> : <><path d="M3 3h10v2h2v8H1V5h2z" className="food-crust" /><path d="M3 5h10v6H3z" className="food-bread" /><path d="M5 5h1v3H5zm5 0h1v3h-1z" className="food-crust" /></>}
    </svg>
  );
  return <span aria-hidden="true">{def(id)?.icon ?? ""}</span>;
}