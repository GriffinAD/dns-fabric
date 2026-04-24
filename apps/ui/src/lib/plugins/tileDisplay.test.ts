import { describe, expect, it } from "vitest";

import { applyPerfCompactAsPercentOnly } from "./tileDisplay";

describe("applyPerfCompactAsPercentOnly", () => {
  it("forces percent_only display_style for perf tiles in compact mode", () => {
    const t = applyPerfCompactAsPercentOnly({
      id: "x",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      options: { display_style: "gauge", cpu_total: true },
    });
    expect(t.options?.display_style).toBe("percent_only");
    expect(t.options?.cpu_total).toBe(true);
  });

  it("leaves full mode and non-perf tiles unchanged", () => {
    const full = applyPerfCompactAsPercentOnly({
      id: "x",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "full",
      options: { display_style: "gauge" },
    });
    expect(full.options?.display_style).toBe("gauge");

    const dhcp = applyPerfCompactAsPercentOnly({
      id: "y",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "compact",
    });
    expect(dhcp.options).toBeUndefined();
  });
});
