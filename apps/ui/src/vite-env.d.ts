/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_AUTH_TOKEN?: string;
  /** When `"1"`, registers `e2e.throwing` tile for Playwright (see `tests/e2e/pluginIsolation.e2e.ts`). */
  readonly VITE_E2E_THROWING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
