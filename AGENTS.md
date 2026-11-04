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
- Arena trees and ruins are editable voxels in world generation with clear chest/spawn cells. Why: all clients must share rendering, collision, mining and loot access.
- Sword silhouettes live in `src/game/sword-appearance.ts`; item SVGs and held meshes reuse them with global CSS material tokens, and held IDs use existing state packets. Why: tier looks remain consistent without extra room channels.
- Castle structures use real editable voxels in world generation, with clear spawn/chest positions and separated tower islands. Why: rendering, collision, mining, and multiplayer must share the same geometry.
- Render world voxels as merged exposed-face geometry in `src/game/voxel-geometry.ts`, leaving world blocks intact. Why: hidden faces and instance transforms must not consume castle frame time or alter mining/collision.
- Map order uses seeded shuffled bags in `src/game/map-sequence.ts`; the host broadcasts the seed on start/reset/sync. Why: randomized rounds and late joiners must generate the same map even after host changes.
- Combat calculations stay pure in `src/game/combat.ts`; engine applies damage and elimination once. Why: PvP balance needs unit tests independent of rendering.
- Healing calculations stay pure in `src/game/healing.ts`; the engine owns the regeneration clock and food consumption, and the frame loop ticks health even while menus are open. Why: healing timing and item conservation must remain testable independently of rendering.
- Timed eating lives in engine state; completing a held action consumes food, and interruptions cancel it. Why: animation and inventory must reflect the same action.
- Armor appearance derives from item IDs through `armor-appearance.ts`; item art and worn shells share global CSS material tokens, and equipment/eating travel in existing state packets. Why: all views and room players must agree on tier and equipment without extra channels.
- Inventory quick transfers and armor swaps stay pure in `src/game/inventory.ts`; UI broadcasts changed chest slots through the engine. Why: stack conservation and equipment rules remain testable without rendering or networking.
- Room chat uses the existing room broadcast channel, bounded history and per-sender throttling; chatOpen gates gameplay input. Why: typing must not trigger gameplay or extra subscriptions.
- Development-only `window.__game` exposes state (including map), startRound(), hit(target, damage), equip(itemIds), prepareFood(id), prepareSwords(), showMap(index), eat(now), tickEating(holding, now), and place(x,y,z,yaw); `[data-scene-ready]` marks a rendered frame. Why: gameplay and arena visual checks need the live state without duplicate module imports; showMap is local-only inspection, not multiplayer coordination.
