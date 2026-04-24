import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

import { mockApiPlugin } from "./vite-plugin-mock-api";

export default defineConfig({
  resolve: {
    /* Without `browser`, Vitest resolves `svelte` / `svelte/store` to the server entry and `mount()` throws. */
    conditions: ["browser", "import", "module", "default"],
  },
  plugins: [tailwindcss(), mockApiPlugin(), svelte()],
  server: {
    /* Default `host: "localhost"` can make the dev server unreachable from Cursor’s embedded
     * browser (and some IDE previews) while Safari/Chrome work. Listen on all interfaces. */
    host: true,
    /* Without this, a non-matching `Host` header (some embedded browsers / port-forward tools)
     * can yield 403 from Vite’s host check so module scripts never load (blank #app). */
    allowedHosts: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/vitest-setup.ts"],
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/types.ts",
        "src/lib/appDashboardShell.ts",
        "src/lib/components/tablePluginShell.ts",
      ],
      /* Root reorder overlap fallback (pack when placementsOverlap) is hard to hit without
       * exporting the checker; 98% lines / 90% branches matches the expanded dashboard model. */
      thresholds: {
        lines: 98,
        functions: 99,
        branches: 90,
        statements: 98,
      },
    },
  },
});
