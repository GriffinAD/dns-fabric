import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";
import {
  initialDashboardLayout,
  loadDashboardLayout,
  mergeMissingDefaultPlugins,
  parseDashboardLayout,
  saveDashboardLayout,
} from "./layoutStorage";

describe("parseDashboardLayout", () => {
  it("accepts a valid layout", () => {
    const parsed = parseDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
    expect(parsed).not.toBeNull();
    expect(parsed?.tiles.length).toBe(DEFAULT_DASHBOARD_LAYOUT.tiles.length);
  });

  it("rejects invalid tiles", () => {
    expect(parseDashboardLayout({ version: 1, tiles: [{}] })).toBeNull();
  });

  it("accepts optional grid placement and rejects out-of-bounds grid", () => {
    const base = {
      id: "a",
      pluginId: "p",
      hostControl: "single-panel" as const,
      displayMode: "full" as const,
    };
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 } }],
      }),
    ).not.toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 6, row: 0, colSpan: 7, rowSpan: 1 } }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 0, row: 0, colSpan: 12 } }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: "0", row: 0, colSpan: 1, rowSpan: 1 } }],
      }),
    ).toBeNull();
    expect(parseDashboardLayout({ version: 1, tiles: [{ ...base, grid: [] }] })).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 0.5, row: 0, colSpan: 1, rowSpan: 1 } }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: -1, row: 0, colSpan: 2, rowSpan: 1 } }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 0, row: -1, colSpan: 1, rowSpan: 1 } }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 0, row: 0, colSpan: 1, rowSpan: 0 } }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 0, row: 0, colSpan: 1, rowSpan: 13 } }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 0, row: 500, colSpan: 1, rowSpan: 1 } }],
      }),
    ).not.toBeNull();
  });

  it("rejects missing version", () => {
    expect(parseDashboardLayout({ tiles: [] })).toBeNull();
  });

  it("rejects invalid tile options", () => {
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [
          {
            id: "a",
            pluginId: "p",
            hostControl: "single-panel",
            displayMode: "full",
            options: { cpu_total: "no" },
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects bad option field types", () => {
    const base = {
      id: "a",
      pluginId: "p",
      hostControl: "single-panel" as const,
      displayMode: "full" as const,
    };
    expect(parseDashboardLayout({ version: 1, tiles: [{ ...base, options: { network_by_adapter: 1 } }] })).toBeNull();
    expect(parseDashboardLayout({ version: 1, tiles: [{ ...base, options: { disk_by_volume: 1 } }] })).toBeNull();
    expect(
      parseDashboardLayout({ version: 1, tiles: [{ ...base, options: { display_style: "big" } }] }),
    ).toBeNull();
    expect(
      parseDashboardLayout({ version: 1, tiles: [{ ...base, options: { perf_max_cols: 0 } }] }),
    ).toBeNull();
    expect(
      parseDashboardLayout({ version: 1, tiles: [{ ...base, options: { perf_max_cols: 4 } }] }),
    ).not.toBeNull();
    expect(
      parseDashboardLayout({ version: 1, tiles: [{ ...base, options: { perf_max_cols: 2.5 } }] }),
    ).toBeNull();
    expect(parseDashboardLayout({ version: 1, tiles: [{ ...base, options: {} }] })).not.toBeNull();
  });

  it("rejects invalid root and tile shape", () => {
    expect(parseDashboardLayout(null)).toBeNull();
    expect(parseDashboardLayout(undefined)).toBeNull();
    expect(parseDashboardLayout(3)).toBeNull();
    expect(parseDashboardLayout({ version: 0, tiles: [] })).toBeNull();
    expect(parseDashboardLayout({ version: 1, tiles: {} })).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ id: "", pluginId: "p", hostControl: "single-panel", displayMode: "full" }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ id: "a", pluginId: "p", hostControl: "invalid", displayMode: "full" }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ id: "a", pluginId: "p", hostControl: "single-panel", displayMode: "wide" }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ id: "a", pluginId: "p", hostControl: "single-panel", displayMode: "full", region: 1 }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ id: "a", pluginId: "p", hostControl: "single-panel", displayMode: "full", options: [] }],
      }),
    ).toBeNull();
    expect(parseDashboardLayout({ version: 1, tiles: [null] })).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ id: 1, pluginId: "p", hostControl: "single-panel", displayMode: "full" } as unknown],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ id: "a", pluginId: "", hostControl: "single-panel", displayMode: "full" }],
      }),
    ).toBeNull();
  });
});

describe("localStorage persistence", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loadDashboardLayout returns null when storage empty", () => {
    expect(loadDashboardLayout()).toBeNull();
  });

  it("round-trips save and load", () => {
    saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
    const loaded = loadDashboardLayout();
    expect(loaded?.version).toBe(DEFAULT_DASHBOARD_LAYOUT.version);
    expect(loaded?.tiles.length).toBe(DEFAULT_DASHBOARD_LAYOUT.tiles.length);
  });

  it("loadDashboardLayout returns null on invalid JSON", () => {
    store["kea-fabric-dashboard-layout"] = "{";
    expect(loadDashboardLayout()).toBeNull();
  });

  it("initialDashboardLayout falls back to default when nothing stored", () => {
    store = {};
    const init = initialDashboardLayout();
    expect(init.version).toBe(DEFAULT_DASHBOARD_LAYOUT.version);
  });

  it("mergeMissingDefaultPlugins appends default tiles absent from saved layout", () => {
    const partial = {
      version: 1 as const,
      tiles: DEFAULT_DASHBOARD_LAYOUT.tiles.filter((t) => t.pluginId === "dhcp.pools"),
    };
    const merged = mergeMissingDefaultPlugins(partial);
    const ids = new Set(merged.tiles.map((t) => t.pluginId));
    expect(ids.has("dhcp.pools")).toBe(true);
    expect(ids.has("dhcp.clients")).toBe(true);
    expect(ids.has("dhcp.reservations")).toBe(true);
    expect(merged.tiles.length).toBe(DEFAULT_DASHBOARD_LAYOUT.tiles.length);
  });

  it("mergeMissingDefaultPlugins returns the same layout when nothing is missing", () => {
    const full = structuredClone(DEFAULT_DASHBOARD_LAYOUT);
    const merged = mergeMissingDefaultPlugins(full);
    expect(merged).toBe(full);
    expect(merged.tiles.length).toBe(DEFAULT_DASHBOARD_LAYOUT.tiles.length);
  });

  it("initialDashboardLayout merges in missing plugins when storage has partial layout", () => {
    const partial = {
      version: 1 as const,
      tiles: DEFAULT_DASHBOARD_LAYOUT.tiles.filter((t) => t.pluginId === "dhcp.pools"),
    };
    store["kea-fabric-dashboard-layout"] = JSON.stringify(partial);
    const init = initialDashboardLayout();
    expect(init.tiles.length).toBe(DEFAULT_DASHBOARD_LAYOUT.tiles.length);
  });

  it("initialDashboardLayout strips legacy tile but keeps merge when defaults already complete", () => {
    const stored = {
      version: 1 as const,
      tiles: [
        ...DEFAULT_DASHBOARD_LAYOUT.tiles.map((t) => structuredClone(t)),
        {
          id: "tile-perf-legacy",
          pluginId: "perf.summary",
          hostControl: "single-panel" as const,
          displayMode: "full" as const,
          grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
        },
      ],
    };
    store["kea-fabric-dashboard-layout"] = JSON.stringify(stored);
    const init = initialDashboardLayout();
    expect(init.tiles.some((t) => t.pluginId === "perf.summary")).toBe(false);
    expect(init.tiles.length).toBe(DEFAULT_DASHBOARD_LAYOUT.tiles.length);
    const reloaded = loadDashboardLayout();
    expect(reloaded?.tiles.some((t) => t.pluginId === "perf.summary")).toBe(false);
    expect(reloaded?.tiles.length).toBe(DEFAULT_DASHBOARD_LAYOUT.tiles.length);
  });

  it("initialDashboardLayout removes legacy perf.summary from storage and persists", () => {
    const withSummary = {
      version: 1 as const,
      tiles: [
        {
          id: "tile-perf-legacy",
          pluginId: "perf.summary",
          hostControl: "single-panel" as const,
          displayMode: "full" as const,
          grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
        },
        {
          id: "tile-pools-only",
          pluginId: "dhcp.pools",
          hostControl: "single-panel" as const,
          displayMode: "full" as const,
          grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
        },
      ],
    };
    store["kea-fabric-dashboard-layout"] = JSON.stringify(withSummary);
    const init = initialDashboardLayout();
    expect(init.tiles.some((t) => t.pluginId === "perf.summary")).toBe(false);
    const reloaded = loadDashboardLayout();
    expect(reloaded?.tiles.some((t) => t.pluginId === "perf.summary")).toBe(false);
  });

  it("saveDashboardLayout is a no-op without localStorage", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", undefined);
    expect(() => saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT)).not.toThrow();
  });

  it("loadDashboardLayout returns null without localStorage", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", undefined);
    expect(loadDashboardLayout()).toBeNull();
  });
});
