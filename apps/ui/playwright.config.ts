import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // *.e2e.ts avoids overlap with Vitest's **/*.{test,spec}.ts when tools scan the repo root.
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173/",
    /* Default false so `VITE_E2E_THROWING` from `env` below is always applied (reuse skips webServer). */
    reuseExistingServer: process.env.PW_REUSE_DEV_SERVER === "1",
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_E2E_THROWING: "1",
    },
  },
});
