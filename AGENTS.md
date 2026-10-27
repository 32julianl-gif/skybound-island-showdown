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
