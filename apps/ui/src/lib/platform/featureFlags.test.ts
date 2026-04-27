import { afterEach, describe, expect, it, vi } from "vitest";

import { getFeatureFlag } from "./featureFlags";

/** Subset of `import.meta.env` shape; avoids importing `vite/client` (not a module under svelte-check). */
type ViteImportMetaEnv = Record<string, string | boolean | undefined>;

describe("featureFlags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns defaults when env unset", () => {
    expect(getFeatureFlag("ui.palette.v2")).toBe(true);
  });

  it("reads VITE_UI_PALETTE_V2 when stubbed", () => {
    vi.stubEnv("VITE_UI_PALETTE_V2", "true");
    expect(getFeatureFlag("ui.palette.v2")).toBe(true);
  });

  it("falls back to defaults when import.meta.env is undefined", () => {
    const meta = import.meta as unknown as { env: ViteImportMetaEnv | null | undefined };
    const prev = meta.env;
    meta.env = undefined;
    try {
      expect(getFeatureFlag("ui.palette.v2")).toBe(true);
    } finally {
      meta.env = prev;
    }
  });

  it("falls back to defaults when import.meta.env is null", () => {
    const meta = import.meta as unknown as { env: ViteImportMetaEnv | null | undefined };
    const prev = meta.env;
    meta.env = null;
    try {
      expect(getFeatureFlag("ui.palette.v2")).toBe(true);
    } finally {
      meta.env = prev;
    }
  });

  it("treats boolean false in import.meta.env as off", () => {
    const meta = import.meta as unknown as { env: Record<string, unknown> };
    const had = Object.prototype.hasOwnProperty.call(meta.env, "VITE_UI_PALETTE_V2");
    const prevVal = meta.env.VITE_UI_PALETTE_V2;
    meta.env.VITE_UI_PALETTE_V2 = false;
    try {
      expect(getFeatureFlag("ui.palette.v2")).toBe(false);
    } finally {
      if (had) meta.env.VITE_UI_PALETTE_V2 = prevVal;
      else delete meta.env.VITE_UI_PALETTE_V2;
    }
  });

  it("treats explicit false string as off", () => {
    vi.stubEnv("VITE_UI_PALETTE_V2", "false");
    expect(getFeatureFlag("ui.palette.v2")).toBe(false);
  });
});
