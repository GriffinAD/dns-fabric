/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /**
   * Kea Fabric HTTP/SSE origin for the Pi-hole CP embedded bundle (perf, DHCP, discovery).
   * Takes precedence over `VITE_API_BASE_URL` when the constructor base URL is empty.
   */
  readonly VITE_KEA_FABRIC_API_BASE_URL?: string;
  /** Pi-hole control plane HTTP origin (`/dashboard`, `/v1/meta`, …). */
  readonly VITE_PIHOLE_CP_BASE_URL?: string;
  /** Control-plane mutation token (dev only; prefer session entry in settings UI). */
  readonly VITE_PIHOLE_CP_API_TOKEN?: string;
  readonly VITE_API_AUTH_TOKEN?: string;
  /** When `"1"`, registers `e2e.throwing` tile for Playwright (see `tests/e2e/pluginIsolation.e2e.ts`). */
  readonly VITE_E2E_THROWING?: string;
  /** Pi-hole CP embed build stamp (injected at `build:pihole-cp-embed` time). */
  readonly VITE_PIHOLE_CP_UI_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
