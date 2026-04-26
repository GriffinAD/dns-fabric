import { afterEach, describe, expect, it, vi } from "vitest";

import { getFeatureFlag } from "./featureFlags";

describe("featureFlags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns defaults when env unset", () => {
    expect(getFeatureFlag("ui.palette.v2")).toBe(true);
    expect(getFeatureFlag("ui.drag.enhanced")).toBe(false);
    expect(getFeatureFlag("ui.registry.v2")).toBe(false);
  });

  it("reads VITE_UI_PALETTE_V2 when stubbed", () => {
    vi.stubEnv("VITE_UI_PALETTE_V2", "true");
    expect(getFeatureFlag("ui.palette.v2")).toBe(true);
  });

  it("treats explicit false string as off", () => {
    vi.stubEnv("VITE_UI_DRAG_ENHANCED", "false");
    expect(getFeatureFlag("ui.drag.enhanced")).toBe(false);
  });
});
