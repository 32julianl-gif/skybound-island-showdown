<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Sky Wars game: mutable game state lives in `src/game/engine.ts` (G), HUD reads a tiny external store (`src/game/store.ts`); networking is client-authoritative Cloud realtime broadcast, one channel per room (`src/game/net.ts`). Why: per-frame data must stay out of React state, and there is no game server.
- World generation in `src/game/world.ts` must stay deterministic (hash-based, no Math.random). Why: every client builds the same map locally; only block edits are broadcast.
- Combat calculations stay pure in `src/game/combat.ts`; engine applies damage and elimination once. Why: PvP balance needs unit tests independent of rendering.
- Inventory quick transfers and armor swaps stay pure in `src/game/inventory.ts`; UI broadcasts changed chest slots through the engine. Why: stack conservation and equipment rules remain testable without rendering or networking.
- Room chat uses the existing room broadcast channel, bounded history and per-sender throttling; chatOpen gates gameplay input. Why: typing must not trigger gameplay or extra subscriptions.
- Development-only `window.__game` exposes state, startRound(), hit(target, damage), and equip(itemIds); `[data-scene-ready]` marks a rendered frame. Why: two-player combat checks need the live state without duplicate module imports.
