import { describe, expect, it, vi } from "vitest";

import { DataGateway } from "../dataGateway";
import { mountDashboardGatewaySideEffects } from "./dashboardBootstrap";
import type { DashboardLayoutV2 } from "./types";

describe("mountDashboardGatewaySideEffects", () => {
  it("invokes handlers for plugins, layout, and SSE cpu metric", async () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "listPlugins").mockResolvedValue({
      items: [{ id: "a", name: "A", enabled: true }],
    });
    const layout: DashboardLayoutV2 = {
      version: 2,
      items: [
        {
          kind: "tile",
          id: "t",
          pluginId: "dhcp.pools",
          hostControl: "single-panel",
          displayMode: "full",
        },
      ],
    };
    vi.spyOn(gw, "getDashboardLayout").mockResolvedValue(layout);
    const unsub = vi.fn();
    vi.spyOn(gw, "subscribeFabricEvents").mockImplementation((onEvent) => {
      queueMicrotask(() => {
        onEvent({
          topic: "fabric.perf.updated",
          occurred_at: "2026-01-01T00:00:00Z",
          payload: { cpu_percent_total: 44 },
        });
      });
      return unsub;
    });

    const plugins: unknown[] = [];
    const layouts: unknown[] = [];
    const cpus: unknown[] = [];
    const stop = mountDashboardGatewaySideEffects(gw, {
      onPluginsLoaded: (items) => plugins.push(items),
      onPluginListError: () => {},
      onServerLayoutApplied: (l) => layouts.push(l),
      onLiveCpuPercent: (v) => cpus.push(v),
    });

    await vi.waitUntil(() => cpus.length > 0);
    expect(plugins.length).toBe(1);
    expect(layouts.length).toBe(1);
    expect(cpus[0]).toBe(44);
    stop();
    expect(unsub).toHaveBeenCalled();
  });

  it("surfaces plugin list errors", async () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "listPlugins").mockRejectedValue(new Error("network"));
    vi.spyOn(gw, "getDashboardLayout").mockResolvedValue({ version: 2, items: [] });
    vi.spyOn(gw, "subscribeFabricEvents").mockReturnValue(() => {});
    const errors: string[] = [];
    const stop = mountDashboardGatewaySideEffects(gw, {
      onPluginsLoaded: () => {},
      onPluginListError: (m) => errors.push(m),
      onServerLayoutApplied: () => {},
      onLiveCpuPercent: () => {},
    });
    await vi.waitUntil(() => errors.some((e) => e.includes("network")));
    stop();
  });

  it("onPluginListError receives non-Error rejection", async () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "listPlugins").mockRejectedValue("plain");
    vi.spyOn(gw, "getDashboardLayout").mockResolvedValue({ version: 2, items: [] });
    vi.spyOn(gw, "subscribeFabricEvents").mockReturnValue(() => {});
    const errors: string[] = [];
    const stop = mountDashboardGatewaySideEffects(gw, {
      onPluginsLoaded: () => {},
      onPluginListError: (m) => errors.push(m),
      onServerLayoutApplied: () => {},
      onLiveCpuPercent: () => {},
    });
    await vi.waitUntil(() => errors.length > 0);
    expect(errors[0]).toBe("plain");
    stop();
  });

  it("onPluginListError uses String(Error) when Error message is empty", async () => {
    const gw = new DataGateway("");
    const err = new Error();
    err.message = "";
    vi.spyOn(gw, "listPlugins").mockRejectedValue(err);
    vi.spyOn(gw, "getDashboardLayout").mockResolvedValue({ version: 2, items: [] });
    vi.spyOn(gw, "subscribeFabricEvents").mockReturnValue(() => {});
    const errors: string[] = [];
    const stop = mountDashboardGatewaySideEffects(gw, {
      onPluginsLoaded: () => {},
      onPluginListError: (m) => errors.push(m),
      onServerLayoutApplied: () => {},
      onLiveCpuPercent: () => {},
    });
    await vi.waitUntil(() => errors.length > 0);
    expect(errors[0]).toBe("Error");
    stop();
  });

  it("ignores unparseable dashboard layout from server", async () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "listPlugins").mockResolvedValue({ items: [] });
    vi.spyOn(gw, "getDashboardLayout").mockResolvedValue({ version: 2, items: "bad" } as never);
    vi.spyOn(gw, "subscribeFabricEvents").mockReturnValue(() => {});
    const layouts: unknown[] = [];
    const stop = mountDashboardGatewaySideEffects(gw, {
      onPluginsLoaded: () => {},
      onPluginListError: () => {},
      onServerLayoutApplied: (l) => layouts.push(l),
      onLiveCpuPercent: () => {},
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(layouts.length).toBe(0);
    stop();
  });
});
