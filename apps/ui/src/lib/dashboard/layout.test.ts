import { describe, expect, it } from "vitest";

import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";

describe("DEFAULT_DASHBOARD_LAYOUT", () => {
  it("matches layout schema shape", () => {
    expect(DEFAULT_DASHBOARD_LAYOUT.version).toBe(1);
    expect(DEFAULT_DASHBOARD_LAYOUT.tiles.length).toBeGreaterThan(0);
    for (const t of DEFAULT_DASHBOARD_LAYOUT.tiles) {
      expect(t.id).toBeTruthy();
      expect(t.pluginId).toBeTruthy();
      expect(t.hostControl).toBeTruthy();
      expect(t.displayMode).toMatch(/compact|full/);
    }
    const perf = DEFAULT_DASHBOARD_LAYOUT.tiles.find((t) => t.pluginId === "perf.summary");
    expect(perf?.options?.display_style).toBe("gauge");
  });
});
