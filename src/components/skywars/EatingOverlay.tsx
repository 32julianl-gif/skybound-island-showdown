import { useEffect, useRef } from "react";
import { G } from "@/game/engine";
import { eatingProgress } from "@/game/healing";
import { ItemIcon } from "./ItemIcon";

export function EatingOverlay() {
  const root = useRef<HTMLDivElement>(null);
  const apple = useRef<HTMLDivElement>(null);
  const bread = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLProgressElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const eating = G.self.eating;
      if (root.current) root.current.hidden = !eating;
      if (apple.current) apple.current.hidden = eating?.id !== "apple";
      if (bread.current) bread.current.hidden = eating?.id !== "bread";
      if (progress.current) progress.current.value = eating ? eatingProgress(eating.startedAt, performance.now()) : 0;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <div ref={root} hidden className="pointer-events-none fixed inset-0 z-10" data-eating-animation>
    <div className="eating-view"><div ref={apple}><ItemIcon id="apple" /></div><div ref={bread}><ItemIcon id="bread" /></div><div className="eating-hand" /></div>
    <progress ref={progress} max={1} value={0} aria-label="Eating progress" className="eating-progress" />
  </div>;
}