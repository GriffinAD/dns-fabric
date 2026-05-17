import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";
import * as gridPlacement from "../grid/gridPlacement";
import { iterateTilesInLayout } from "./layoutTree";
import {
  buildDashboardLayoutDownloadPayload,
  clearStoredDashboardLayoutAndUnlock,
  dashboardLayoutExportFilename,
  downloadDashboardLayoutFile,
  isLayoutLocalPersistBlocked,
  layoutJsonUnsupportedVersionMessage,
  loadDashboardLayout,
  parseDashboardLayout,
  saveDashboardLayout,
  setLocalPersistBlockedStateForTest,
} from "./layoutStorage";
import { initialDashboardLayout, mergeMissingDefaultPlugins } from "../persistence";
import type { DashboardLayout, DashboardLayoutV1, DashboardLayoutV2, DashboardLayoutV3, DashboardTile } from "../types";
import { isLayoutV2, isLayoutV3 } from "../types";

function allTilesIn(layout: DashboardLayout | null | undefined): DashboardTile[] {
  if (!layout) return [];
  if (isLayoutV3(layout) || isLayoutV2(layout)) return [...iterateTilesInLayout(layout.items)];
  return layout.tiles;
}

function countAllTilesV2(d: DashboardLayoutV2 | DashboardLayoutV3): number {
  return allTilesIn(d).length;
}

describe("layoutJsonUnsupportedVersionMessage", () => {
  it("returns message for layout version > 3", () => {
    expect(layoutJsonUnsupportedVersionMessage({ version: 4, items: [] })).toContain("version 4");
    expect(layoutJsonUnsupportedVersionMessage({ version: 3, items: [] })).toBeNull();
    expect(layoutJsonUnsupportedVersionMessage({ version: 2, items: [] })).toBeNull();
  });

  it("returns null for non-objects or missing version", () => {
    expect(layoutJsonUnsupportedVersionMessage(null)).toBeNull();
    expect(layoutJsonUnsupportedVersionMessage({ items: [] })).toBeNull();
  });
});

describe("parseDashboardLayout", () => {
  it("rejects layout version > 3", () => {
    expect(parseDashboardLayout({ version: 4, items: [] })).toBeNull();
  });

  it("rejects v2 with unknown root item kind", () => {
    expect(
      parseDashboardLayout({
        version: 2,
        items: [{ kind: "bogus", id: "x" }],
      } as unknown),
    ).toBeNull();
  });

  it("accepts a valid layout", () => {
    const parsed = parseDashboardLayout(structuredClone(DEFAULT_DASHBOARD_LAYOUT));
    expect(parsed).not.toBeNull();
    expect(isLayoutV3(parsed!)).toBe(true);
    expect((parsed as DashboardLayoutV3).items.length).toBe(DEFAULT_DASHBOARD_LAYOUT.items.length);
  });

  it("rejects invalid tiles", () => {
    expect(parseDashboardLayout({ version: 1, tiles: [{}] })).toBeNull();
  });

  it("accepts group child grid past col 11 when Auto wrap is off", () => {
    const ok = parseDashboardLayout({
      version: 2,
      items: [
        {
          kind: "group",
          id: "g",
          children: [
            {
              id: "a",
              pluginId: "perf.cpu",
              hostControl: "single-panel",
              displayMode: "compact",
              grid: { col: 14, row: 0, colSpan: 2, rowSpan: 1 },
            },
          ],
        },
      ],
    });
    expect(ok).not.toBeNull();
  });

  it("rejects group child rowPanel when too long", () => {
    expect(
      parseDashboardLayout({
        version: 2,
        items: [
          {
            kind: "group",
            id: "g",
            children: [
              {
                id: "a",
                pluginId: "perf.cpu",
                hostControl: "single-panel",
                displayMode: "compact",
                rowPanel: `${"x".repeat(64)}y`,
              },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects group child grid past root wrap boundary when Auto wrap is on", () => {
    const bad = parseDashboardLayout({
      version: 2,
      items: [
        {
          kind: "group",
          id: "g",
          innerWrap: true,
          children: [
            {
              id: "a",
              pluginId: "perf.cpu",
              hostControl: "single-panel",
              displayMode: "compact",
              grid: { col: 19, row: 0, colSpan: 2, rowSpan: 1 },
            },
          ],
        },
      ],
    });
    expect(bad).toBeNull();
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
        tiles: [{ ...base, grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 } }],
      }),
    ).not.toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 14, row: 0, colSpan: 7, rowSpan: 1 } }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...base, grid: { col: 0, row: 0, colSpan: 20 } }],
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

  it("rejects rowPanel that is not a 1..64 char string", () => {
    const ok = { id: "a", pluginId: "p", hostControl: "single-panel" as const, displayMode: "full" as const };
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...ok, rowPanel: "a".repeat(65) }],
      }),
    ).toBeNull();
    expect(
      parseDashboardLayout({
        version: 1,
        tiles: [{ ...ok, rowPanel: "status" }],
      }),
    ).not.toBeNull();
  });

  it("rejects bad option field types", () => {
    const perf = {
      id: "a",
      pluginId: "perf.cpu",
      hostControl: "single-panel" as const,
      displayMode: "full" as const,
    };
    expect(parseDashboardLayout({ version: 1, tiles: [{ ...perf, options: { network_by_adapter: 1 } }] })).toBeNull();
    expect(parseDashboardLayout({ version: 1, tiles: [{ ...perf, options: { disk_by_volume: 1 } }] })).toBeNull();
    expect(
      parseDashboardLayout({ version: 1, tiles: [{ ...perf, options: { display_style: "big" } }] }),
    ).toBeNull();
    expect(
      parseDashboardLayout({ version: 1, tiles: [{ ...perf, options: { perf_max_cols: 0 } }] }),
    ).toBeNull();
    expect(
      parseDashboardLayout({ version: 1, tiles: [{ ...perf, options: { perf_max_cols: 4 } }] }),
    ).not.toBeNull();
    expect(
      parseDashboardLayout({ version: 1, tiles: [{ ...perf, options: { perf_max_cols: 2.5 } }] }),
    ).toBeNull();
    const nonPerf = {
      id: "b",
      pluginId: "p",
      hostControl: "single-panel" as const,
      displayMode: "full" as const,
    };
    expect(parseDashboardLayout({ version: 1, tiles: [{ ...nonPerf, options: {} }] })).not.toBeNull();
    expect(
      parseDashboardLayout({ version: 1, tiles: [{ ...nonPerf, options: { perf_max_cols: 4 } }] }),
    ).toBeNull();
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
    expect(isLayoutV3(loaded!)).toBe(true);
    expect((loaded as DashboardLayoutV3).items.length).toBe(DEFAULT_DASHBOARD_LAYOUT.items.length);
  });

  it("save and load honor custom storage key", () => {
    const customKey = "pihole-cp-test-layout-key";
    saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT, customKey);
    expect(store[customKey]).toBeDefined();
    expect(loadDashboardLayout()).toBeNull();
    const loaded = loadDashboardLayout(customKey);
    expect(loaded?.version).toBe(DEFAULT_DASHBOARD_LAYOUT.version);
  });

  it("loadDashboardLayout returns null on invalid JSON", () => {
    store["kea-fabric-dashboard-layout"] = "{";
    expect(loadDashboardLayout()).toBeNull();
  });

  it("loadDashboardLayout returns null and warns when stored version is unsupported", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    store["kea-fabric-dashboard-layout"] = JSON.stringify({ version: 5, items: [] });
    expect(loadDashboardLayout()).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("version 5"));
    expect(isLayoutLocalPersistBlocked()).toBe(true);
    warn.mockRestore();
  });

  it("saveDashboardLayout logs unknown when blocked with null reason", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setLocalPersistBlockedStateForTest(true, null);
    saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("layout cache locked: unknown"),
    );
    setLocalPersistBlockedStateForTest(false, null);
    warn.mockRestore();
  });

  it("saveDashboardLayout no-ops while persist is blocked after unsupported version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    store["kea-fabric-dashboard-layout"] = JSON.stringify({ version: 5, items: [] });
    loadDashboardLayout();
    saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
    expect(store["kea-fabric-dashboard-layout"]).toContain('"version":5');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("clearStoredDashboardLayoutAndUnlock removes storage and clears persist gate", () => {
    store["kea-fabric-dashboard-layout"] = JSON.stringify({ version: 5, items: [] });
    loadDashboardLayout();
    expect(isLayoutLocalPersistBlocked()).toBe(true);
    clearStoredDashboardLayoutAndUnlock();
    expect(store["kea-fabric-dashboard-layout"]).toBeUndefined();
    expect(isLayoutLocalPersistBlocked()).toBe(false);
    saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
    expect(loadDashboardLayout()).not.toBeNull();
  });

  it("clearStoredDashboardLayoutAndUnlock ignores localStorage.removeItem failures", () => {
    vi.stubGlobal(
      "localStorage",
      {
        removeItem: () => {
          throw new Error("quota");
        },
      } as unknown as Storage,
    );
    expect(() => clearStoredDashboardLayoutAndUnlock()).not.toThrow();
    vi.unstubAllGlobals();
  });

  it("initialDashboardLayout clears storage and re-applies default when layoutWithGrid throws", () => {
    store = {};
    saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
    const real = gridPlacement.layoutWithGrid;
    let calls = 0;
    const spy = vi.spyOn(gridPlacement, "layoutWithGrid").mockImplementation((layout) => {
      calls += 1;
      if (calls === 1) {
        throw new Error("forced for test");
      }
      return real(layout);
    });
    const init = initialDashboardLayout();
    expect(calls).toBe(2);
    expect(countAllTilesV2(init)).toBe(countAllTilesV2(DEFAULT_DASHBOARD_LAYOUT));
    expect(store["kea-fabric-dashboard-layout"]).toBeUndefined();
    spy.mockRestore();
  });

  it("initialDashboardLayout still resets if localStorage removeItem throws in error path", () => {
    store = {};
    saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
    const real = gridPlacement.layoutWithGrid;
    let calls = 0;
    const spy = vi.spyOn(gridPlacement, "layoutWithGrid").mockImplementation((layout) => {
      calls += 1;
      if (calls === 1) throw new Error("forced for test");
      return real(layout);
    });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: () => {
        throw new Error("remove failed");
      },
    });
    const init = initialDashboardLayout();
    expect(countAllTilesV2(init)).toBe(countAllTilesV2(DEFAULT_DASHBOARD_LAYOUT));
    spy.mockRestore();
  });

  it("initialDashboardLayout falls back to default when nothing stored", () => {
    store = {};
    const init = initialDashboardLayout();
    expect(init.version).toBe(DEFAULT_DASHBOARD_LAYOUT.version);
  });

  it("mergeMissingDefaultPlugins appends default tiles absent from saved layout", () => {
    const pool = allTilesIn(structuredClone(DEFAULT_DASHBOARD_LAYOUT)).find((t) => t.pluginId === "dhcp.pools")!;
    const { grid: _g, ...poolNoGrid } = pool;
    const partial: DashboardLayoutV1 = { version: 1, tiles: [poolNoGrid] };
    const merged = mergeMissingDefaultPlugins(partial);
    const ids = new Set(allTilesIn(merged).map((t) => t.pluginId));
    expect(ids.has("dhcp.pools")).toBe(true);
    expect(ids.has("dhcp.clients")).toBe(true);
    expect(ids.has("dhcp.reservations")).toBe(true);
    expect(countAllTilesV2(merged)).toBe(countAllTilesV2(DEFAULT_DASHBOARD_LAYOUT));
  });

  it("mergeMissingDefaultPlugins returns the same layout when nothing is missing", () => {
    const full = structuredClone(DEFAULT_DASHBOARD_LAYOUT);
    const merged = mergeMissingDefaultPlugins(full);
    expect(merged).toBe(full);
    expect(countAllTilesV2(merged)).toBe(countAllTilesV2(DEFAULT_DASHBOARD_LAYOUT));
  });

  it("initialDashboardLayout merges in missing plugins when storage has partial layout", () => {
    const pool = allTilesIn(structuredClone(DEFAULT_DASHBOARD_LAYOUT)).find((t) => t.pluginId === "dhcp.pools")!;
    const { grid: _g, ...poolNoGrid } = pool;
    const partial: DashboardLayoutV1 = { version: 1, tiles: [poolNoGrid] };
    store["kea-fabric-dashboard-layout"] = JSON.stringify(partial);
    const init = initialDashboardLayout();
    expect(countAllTilesV2(init)).toBe(countAllTilesV2(DEFAULT_DASHBOARD_LAYOUT));
  });

  it("initialDashboardLayout strips legacy tile but keeps merge when defaults already complete", () => {
    const baseTiles = allTilesIn(structuredClone(DEFAULT_DASHBOARD_LAYOUT)).map((t) => {
      const { grid: _g, ...r } = t;
      return r;
    });
    const stored: DashboardLayoutV1 = {
      version: 1,
      tiles: [
        ...baseTiles.map((t) => structuredClone(t)),
        {
          id: "tile-perf-legacy",
          pluginId: "perf.summary",
          hostControl: "single-panel" as const,
          displayMode: "full" as const,
          grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
        },
      ],
    };
    store["kea-fabric-dashboard-layout"] = JSON.stringify(stored);
    const init = initialDashboardLayout();
    expect(allTilesIn(init).some((t) => t.pluginId === "perf.summary")).toBe(false);
    expect(countAllTilesV2(init)).toBe(countAllTilesV2(DEFAULT_DASHBOARD_LAYOUT));
    const reloaded = loadDashboardLayout();
    expect(allTilesIn(reloaded).some((t) => t.pluginId === "perf.summary")).toBe(false);
    expect(allTilesIn(reloaded).length).toBe(countAllTilesV2(DEFAULT_DASHBOARD_LAYOUT));
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
          grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
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
    expect(allTilesIn(init).some((t) => t.pluginId === "perf.summary")).toBe(false);
    const reloaded = loadDashboardLayout();
    expect(allTilesIn(reloaded).some((t) => t.pluginId === "perf.summary")).toBe(false);
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

describe("dashboard layout file export", () => {
  it("dashboardLayoutExportFilename uses Dashboard_Layout_yyyy-MM-dd_hhmmss", () => {
    const d = new Date(2026, 3, 25, 12, 34, 56);
    expect(dashboardLayoutExportFilename(d)).toBe("Dashboard_Layout_2026-04-25_123456.json");
  });

  it("buildDashboardLayoutDownloadPayload is pretty-printed JSON with trailing newline", () => {
    const L = { version: 2 as const, items: [] };
    const s = buildDashboardLayoutDownloadPayload(L);
    expect(s.endsWith("\n")).toBe(true);
    expect(JSON.parse(s.trim())).toEqual(L);
  });

  it("downloadDashboardLayoutFile creates a blob download and revokes the URL", () => {
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const anchor = document.createElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => {});
    const removeSpy = vi.spyOn(anchor, "remove").mockImplementation(() => {});
    const createSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return anchor;
      return document.createElement(tag as "div");
    });
    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => anchor);

    downloadDashboardLayoutFile(structuredClone(DEFAULT_DASHBOARD_LAYOUT));

    expect(createSpy).toHaveBeenCalledWith("a");
    expect(anchor.download).toMatch(/^Dashboard_Layout_\d{4}-\d{2}-\d{2}_\d{6}\.json$/);

    downloadDashboardLayoutFile(structuredClone(DEFAULT_DASHBOARD_LAYOUT), "Server_Name.json");
    expect(anchor.download).toBe("Server_Name.json");
    expect(anchor.href).toBe("blob:test");
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalledWith(anchor);
    expect(revoke).toHaveBeenCalledWith("blob:test");

    createSpy.mockRestore();
    appendSpy.mockRestore();
    clickSpy.mockRestore();
    removeSpy.mockRestore();
    createUrl.mockRestore();
    revoke.mockRestore();
  });

  it("downloadDashboardLayoutFile is a no-op when document is unavailable", () => {
    const doc = globalThis.document;
    vi.stubGlobal("document", undefined);
    expect(() => downloadDashboardLayoutFile({ version: 2, items: [] })).not.toThrow();
    vi.stubGlobal("document", doc);
  });
});
