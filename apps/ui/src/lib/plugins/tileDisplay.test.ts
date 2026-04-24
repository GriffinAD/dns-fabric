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

  it("keeps gauge display for compact network/disk multi-series options", () => {
    const net = applyPerfCompactAsPercentOnly({
      id: "n",
      pluginId: "perf.network",
      hostControl: "single-panel",
      displayMode: "compact",
      options: { network_by_adapter: true, display_style: "gauge" },
    });
    expect(net.options?.display_style).toBe("gauge");

    const disk = applyPerfCompactAsPercentOnly({
      id: "d",
      pluginId: "perf.disk",
      hostControl: "single-panel",
      displayMode: "compact",
      options: { disk_by_volume: true, display_style: "gauge" },
    });
    expect(disk.options?.display_style).toBe("gauge");
  });

  it("still forces percent_only for compact perf.network without by_adapter", () => {
    const t = applyPerfCompactAsPercentOnly({
      id: "n",
      pluginId: "perf.network",
      hostControl: "single-panel",
      displayMode: "compact",
      options: { display_style: "gauge" },
    });
    expect(t.options?.display_style).toBe("percent_only");
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
