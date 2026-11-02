// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The dev-only devtools plugin adds `data-tsd-source` to every JSX element, which
// react-three-fiber tries to apply as a nested three.js property and crashes on.
// Strip it from 3D scene files (they render R3F elements, not DOM).
const stripR3fSource = {
  name: "strip-tsd-source-r3f",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (!/src\/components\/skywars\/(Scene|SkyWarsGame)\.tsx/.test(id) || !code.includes("data-tsd-source")) return;
    return { code: code.replace(/\s+data-tsd-source=(?:"[^"]*"|\{[^}]*\})/g, ""), map: null };
  },
};

export default defineConfig({
  vite: { plugins: [stripR3fSource] },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
