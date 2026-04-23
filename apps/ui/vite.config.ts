import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

import { mockApiPlugin } from "./vite-plugin-mock-api";

export default defineConfig({
  plugins: [tailwindcss(), mockApiPlugin(), svelte()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/types.ts", "src/lib/**/rowPanelLayout.ts"],
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
