import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

import { mockApiPlugin } from "./vite-plugin-mock-api";

const piholeCpDevProxyTarget =
  process.env.PIHOLE_CP_DEV_PROXY_TARGET ??
  process.env.VITE_PIHOLE_CP_DEV_PROXY ??
  "http://127.0.0.1:8091";

/** When set, build only the Pi-hole CP bundle with `base` `/next/` for embedding under `pihole-ha` `static/next/`. */
const embedPiholeCpUi = process.env.PIHOLE_CP_UI_EMBED === "1";

/** UTC compact stamp for operator header (`v0.4.{build}`); override with `PIHOLE_CP_UI_BUILD`. */
function piholeCpUiBuildStamp(): string {
  const fromEnv = process.env.PIHOLE_CP_UI_BUILD?.trim();
  if (fromEnv) return fromEnv;
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

export default defineConfig({
  base: embedPiholeCpUi ? "/next/" : "/",
  resolve: {
    /* Without `browser`, Vitest resolves `svelte` / `svelte/store` to the server entry and `mount()` throws. */
    conditions: ["browser", "import", "module", "default"],
  },
  plugins: [tailwindcss(), mockApiPlugin(), svelte(), svelteTesting()],
  define: embedPiholeCpUi
    ? { "import.meta.env.VITE_PIHOLE_CP_UI_BUILD": JSON.stringify(piholeCpUiBuildStamp()) }
    : undefined,
  build: {
    rollupOptions: {
      input: embedPiholeCpUi
        ? { piholeCp: "./index-pihole-cp.html" }
        : {
            main: "./index.html",
            piholeCp: "./index-pihole-cp.html",
          },
    },
  },
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
      "/dashboard": {
        target: piholeCpDevProxyTarget,
        changeOrigin: true,
      },
      "/v1": {
        target: piholeCpDevProxyTarget,
        changeOrigin: true,
      },
      "/logs": {
        target: piholeCpDevProxyTarget,
        changeOrigin: true,
      },
      "/health": {
        target: piholeCpDevProxyTarget,
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
      include: ["src/lib/**/*.ts", "src/lib/components/**/*.svelte", "src/lib/theme/**/*.svelte"],
      exclude: [
        "src/lib/**/types.ts",
        "src/lib/app/appDashboardShell.ts",
        "src/lib/components/tablePlugin/tablePluginShell.ts",
        /* v8 + Flowbite Modal: branch/function attribution on dialog + snippets misses global 99%/100% despite Modal tests. */
        "src/lib/components/baseDataTable/BaseDataTableModal.svelte",
        /* v8 reports an extra synthetic branch on the root <select> tag after Svelte compile. */
        "src/lib/components/editors/InlineSelectEditor.svelte",
        /* v8 reports an extra synthetic branch on the page-size <option> template expression. */
        "src/lib/components/baseDataTable/BaseDataTable.svelte",
        "src/lib/**/*.harness.svelte",
        "src/lib/**/*Harness.svelte",
        "src/lib/**/*.test-support.svelte",
        "src/lib/**/__fixtures__/**",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        /* Svelte 5 + v8: excluded Svelte files above; `env == null` in featureFlags.ts duplicates a
         * branch target (null vs undefined) so aggregate branches stay just under 100%. */
        branches: 99,
        statements: 100,
      },
    },
  },
});
