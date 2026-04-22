import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";
import {
  initialDashboardLayout,
  loadDashboardLayout,
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
