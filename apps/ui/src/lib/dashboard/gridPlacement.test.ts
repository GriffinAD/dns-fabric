import { describe, expect, it } from "vitest";

import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";
import {
  clampGridColSpan,
  clampGridRowSpan,
  clampTileGridPlacement,
  gridAreaStyle,
  gridColumnSpanStyle,
  hasCompleteGrid,
  layoutWithGrid,
  normalizeDashboardTiles,
  packTilesToGrid,
  packTilesWithFixedAndFloating,
  placementsOverlap,
  reorderTilesPreservingSlotOrigins,
  tileColSpan,
} from "./gridPlacement";
import type { DashboardLayout, DashboardTile } from "./types";

describe("packTilesToGrid", () => {
  it("matches default dashboard layout geometry", () => {
    const packed = packTilesToGrid(DEFAULT_DASHBOARD_LAYOUT.tiles);
    expect(packed[0].grid).toEqual({ col: 0, row: 0, colSpan: 1, rowSpan: 1 });
    expect(packed[1].grid).toEqual({ col: 1, row: 0, colSpan: 2, rowSpan: 1 });
    expect(packed[2].grid).toEqual({ col: 3, row: 0, colSpan: 1, rowSpan: 1 });
    expect(packed[3].grid).toEqual({ col: 4, row: 0, colSpan: 1, rowSpan: 1 });
    expect(packed[4].grid).toEqual({ col: 5, row: 0, colSpan: 3, rowSpan: 1 });
    expect(packed[5].grid).toEqual({ col: 8, row: 0, colSpan: 3, rowSpan: 1 });
    expect(packed[6].grid).toEqual({ col: 0, row: 1, colSpan: 3, rowSpan: 1 });
    expect(packed[7].grid).toEqual({ col: 0, row: 2, colSpan: 12, rowSpan: 1 });
  });

  it("packs only non-perf tiles as half-width when they follow a full-width row", () => {
    const tiles: DashboardTile[] = [
      {
        id: "a",
        pluginId: "dhcp.pools",
        hostControl: "single-panel",
        displayMode: "full",
      },
      {
        id: "b",
        pluginId: "dhcp.clients",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ];
    const packed = packTilesToGrid(tiles);
    expect(packed[0].grid).toEqual({ col: 0, row: 0, colSpan: 6, rowSpan: 1 });
    expect(packed[1].grid).toEqual({ col: 6, row: 0, colSpan: 6, rowSpan: 1 });
  });

  it("starts a new row when a full-width tile does not fit after a half-width tile", () => {
    const tiles: DashboardTile[] = [
      {
        id: "a",
        pluginId: "dhcp.pools",
        hostControl: "single-panel",
        displayMode: "full",
      },
      {
        id: "b",
        pluginId: "perf.summary",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ];
    const packed = packTilesToGrid(tiles);
    expect(packed[1].grid).toEqual({ col: 0, row: 1, colSpan: 12, rowSpan: 1 });
  });

  it("does not cap the number of layout rows (only tile rowSpan is capped)", () => {
    const tiles: DashboardTile[] = Array.from({ length: 15 }, (_, i) => ({
      id: `t${i}`,
      pluginId: "perf.summary",
      hostControl: "single-panel" as const,
      displayMode: "full" as const,
    }));
    const packed = packTilesToGrid(tiles);
    expect(packed[14].grid?.row).toBe(14);
    expect(packed[14].grid?.col).toBe(0);
  });

  it("stacks full-width tiles vertically when earlier tile has rowSpan > 1", () => {
    const tiles: DashboardTile[] = [
      {
        id: "res",
        pluginId: "dhcp.reservations",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 12, rowSpan: 10 },
      },
      {
        id: "cli",
        pluginId: "dhcp.clients",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 12, rowSpan: 10 },
      },
    ];
    const packed = packTilesToGrid(tiles);
    expect(packed[0].grid).toMatchObject({ col: 0, row: 0, colSpan: 12, rowSpan: 10 });
    expect(packed[1].grid).toMatchObject({ col: 0, row: 10, colSpan: 12, rowSpan: 10 });
  });

  it("normalize keeps explicit gaps when grids are complete and non-overlapping", () => {
    const tiles: DashboardTile[] = [
      {
        id: "a",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "compact",
        grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      },
      {
        id: "b",
        pluginId: "perf.ram",
        hostControl: "single-panel",
        displayMode: "compact",
        grid: { col: 6, row: 0, colSpan: 1, rowSpan: 1 },
      },
    ];
    const norm = normalizeDashboardTiles(tiles);
    expect(norm[0].grid).toMatchObject({ col: 0, row: 0, colSpan: 1 });
    expect(norm[1].grid).toMatchObject({ col: 6, row: 0, colSpan: 1 });
  });

  it("reorder preserves each tile origin when list order is unchanged", () => {
    const tiles: DashboardTile[] = [
      {
        id: "a",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "compact",
        grid: { col: 6, row: 0, colSpan: 1, rowSpan: 1 },
      },
      {
        id: "b",
        pluginId: "perf.ram",
        hostControl: "single-panel",
        displayMode: "compact",
        grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      },
    ];
    const next = reorderTilesPreservingSlotOrigins(tiles, [...tiles]);
    expect(next[0].grid).toMatchObject({ col: 6, row: 0 });
    expect(next[1].grid).toMatchObject({ col: 0, row: 0 });
  });

  it("reorder permutes origins by sorted slots when order changes", () => {
    const a: DashboardTile = {
      id: "a",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
    };
    const b: DashboardTile = {
      id: "b",
      pluginId: "perf.ram",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 6, row: 0, colSpan: 1, rowSpan: 1 },
    };
    const next = reorderTilesPreservingSlotOrigins([a, b], [b, a]);
    expect(next[0].id).toBe("b");
    expect(next[0].grid).toMatchObject({ col: 0, row: 0 });
    expect(next[1].id).toBe("a");
    expect(next[1].grid).toMatchObject({ col: 6, row: 0 });
  });

  it("wraps when a row is full", () => {
    const tiles: DashboardTile[] = [
      {
        id: "a",
        pluginId: "dhcp.pools",
        hostControl: "single-panel",
        displayMode: "full",
      },
      {
        id: "b",
        pluginId: "dhcp.clients",
        hostControl: "single-panel",
        displayMode: "full",
      },
      {
        id: "c",
        pluginId: "dhcp.reservations",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ];
    const packed = packTilesToGrid(tiles);
    expect(packed[2].grid?.row).toBe(1);
    expect(packed[2].grid?.col).toBe(0);
  });
});

describe("gridAreaStyle", () => {
  it("emits 1-based CSS grid lines", () => {
    expect(gridAreaStyle({ col: 0, row: 1, colSpan: 6, rowSpan: 1 })).toBe(
      "grid-column: 1 / span 6; grid-row: 2 / span 1;",
    );
  });
});

describe("clampGridRowSpan", () => {
  it("caps tile height at 12 rows", () => {
    expect(clampGridRowSpan(1)).toBe(1);
    expect(clampGridRowSpan(12)).toBe(12);
    expect(clampGridRowSpan(20)).toBe(12);
  });
});

describe("clampGridColSpan", () => {
  it("treats non-finite values as span 1", () => {
    expect(clampGridColSpan(Number.NaN)).toBe(1);
    expect(clampGridColSpan(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampGridRowSpan(Number.NaN)).toBe(1);
    expect(clampGridRowSpan(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("tileColSpan and gridColumnSpanStyle", () => {
  const base = (pluginId: string): DashboardTile => ({
    id: "x",
    pluginId,
    hostControl: "single-panel",
    displayMode: "full",
  });

  it("uses distinct default spans for perf plugins", () => {
    expect(tileColSpan(base("perf.summary"))).toBe(12);
    expect(tileColSpan(base("perf.cpu"))).toBe(1);
    expect(tileColSpan(base("perf.ram"))).toBe(1);
    expect(tileColSpan(base("perf.network"))).toBe(1);
    expect(tileColSpan(base("perf.disk"))).toBe(1);
    expect(tileColSpan(base("dhcp.pools"))).toBe(6);
  });

  it("emits span-only grid-column and grid-row for auto placement", () => {
    expect(gridColumnSpanStyle(base("perf.summary"))).toBe(
      "grid-column: span 12; grid-row: span 1; min-width: 0;",
    );
    expect(gridColumnSpanStyle(base("perf.cpu"))).toBe(
      "grid-column: span 1; grid-row: span 1; min-width: 0;",
    );
    expect(gridColumnSpanStyle(base("perf.ram"))).toBe(
      "grid-column: span 1; grid-row: span 1; min-width: 0;",
    );
    expect(gridColumnSpanStyle(base("dhcp.pools"))).toBe(
      "grid-column: span 6; grid-row: span 1; min-width: 0;",
    );
  });

  it("honors custom colSpan and rowSpan on tile", () => {
    const t: DashboardTile = {
      ...base("dhcp.pools"),
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 2 },
    };
    const packed = packTilesToGrid([t]);
    expect(packed[0].grid?.colSpan).toBe(4);
    expect(packed[0].grid?.rowSpan).toBe(2);
    expect(gridColumnSpanStyle(t)).toBe("grid-column: span 4; grid-row: span 2; min-width: 0;");
  });
});

describe("layoutWithGrid", () => {
  it("returns a new layout object with packed tiles", () => {
    const base: DashboardLayout = {
      version: 1,
      tiles: DEFAULT_DASHBOARD_LAYOUT.tiles.map((t) => {
        const { grid: _g, ...rest } = t;
        return rest;
      }),
    };
    const next = layoutWithGrid(base);
    expect(next.tiles[0].grid?.colSpan).toBe(1);
  });
});

describe("grid placement edge cases", () => {
  const tile = (id: string, grid?: DashboardTile["grid"], pluginId = "dhcp.pools"): DashboardTile => ({
    id,
    pluginId,
    hostControl: "single-panel",
    displayMode: "full",
    ...(grid != null ? { grid } : {}),
  });

  it("hasCompleteGrid rejects non-integer coordinates and rowSpan bounds", () => {
    expect(hasCompleteGrid(tile("a", { col: 1.2, row: 0, colSpan: 1, rowSpan: 1 }))).toBe(false);
    expect(hasCompleteGrid(tile("a", { col: 0, row: 0, colSpan: 1, rowSpan: 13 }))).toBe(false);
  });

  it("hasCompleteGrid rejects non-number fields from loose grid objects", () => {
    const badCol = { col: "0" as unknown as number, row: 0, colSpan: 1, rowSpan: 1 };
    expect(hasCompleteGrid(tile("a", badCol))).toBe(false);
    const missingRowSpan = { col: 0, row: 0, colSpan: 1 } as DashboardTile["grid"];
    expect(hasCompleteGrid(tile("a", missingRowSpan))).toBe(false);
  });

  it("hasCompleteGrid rejects column geometry outside the 12-column grid", () => {
    expect(hasCompleteGrid(tile("a", { col: 6, row: 0, colSpan: 8, rowSpan: 1 }))).toBe(false);
  });

  it("placementsOverlap is false for separate rects and true when they intersect", () => {
    expect(placementsOverlap([])).toBe(false);
    expect(placementsOverlap([{ col: 0, row: 0, colSpan: 12, rowSpan: 1 }])).toBe(false);
    expect(
      placementsOverlap([
        { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
        { col: 6, row: 0, colSpan: 6, rowSpan: 1 },
      ]),
    ).toBe(false);
    expect(
      placementsOverlap([
        { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
        { col: 4, row: 0, colSpan: 8, rowSpan: 1 },
      ]),
    ).toBe(true);
  });

  it("normalizeDashboardTiles returns an empty list unchanged", () => {
    expect(normalizeDashboardTiles([])).toEqual([]);
  });

  it("normalizeDashboardTiles repacks when explicit layouts overlap", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 12, rowSpan: 1 });
    const b = tile("b", { col: 0, row: 0, colSpan: 12, rowSpan: 1 });
    const out = normalizeDashboardTiles([a, b]);
    expect(out[0].grid?.row !== out[1].grid?.row || out[0].grid?.col !== out[1].grid?.col).toBe(true);
  });

  it("packTilesWithFixedAndFloating places tiles without grid after fixed tiles", () => {
    const fixed = tile("f", { col: 0, row: 0, colSpan: 6, rowSpan: 1 });
    const floating = tile("g", undefined);
    const out = packTilesWithFixedAndFloating([fixed, floating]);
    expect(out).toHaveLength(2);
    expect(out[1].grid).toBeDefined();
  });

  it("packTilesWithFixedAndFloating falls back to pack when fixed footprints overlap", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 12, rowSpan: 1 });
    const b = tile("b", { col: 0, row: 0, colSpan: 12, rowSpan: 1 });
    const out = packTilesWithFixedAndFloating([a, b]);
    expect(placementsOverlap(out.map((t) => t.grid!))).toBe(false);
  });

  it("reorderTilesPreservingSlotOrigins repacks when tile counts differ", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 12, rowSpan: 1 });
    const b = tile("b", { col: 0, row: 1, colSpan: 12, rowSpan: 1 });
    const out = reorderTilesPreservingSlotOrigins([a], [a, b]);
    expect(out).toHaveLength(2);
  });

  it("reorderTilesPreservingSlotOrigins clamps when order unchanged but grid incomplete", () => {
    const incomplete = tile("x", undefined);
    const out = reorderTilesPreservingSlotOrigins([incomplete], [{ ...incomplete }]);
    expect(out[0].grid).toBeDefined();
  });

  it("reorderTilesPreservingSlotOrigins repacks when any previous tile lacked a grid", () => {
    const full = tile("a", { col: 0, row: 0, colSpan: 12, rowSpan: 1 });
    const partial = tile("b", undefined);
    const out = reorderTilesPreservingSlotOrigins([full, partial], [partial, full]);
    expect(out.every((t) => t.grid != null)).toBe(true);
  });

  it("reorderTilesPreservingSlotOrigins repacks when permutation would overlap spans", () => {
    const a: DashboardTile = {
      id: "a",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
    };
    const b: DashboardTile = {
      id: "b",
      pluginId: "dhcp.clients",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 4, row: 0, colSpan: 8, rowSpan: 1 },
    };
    const out = reorderTilesPreservingSlotOrigins([a, b], [b, a]);
    expect(placementsOverlap(out.map((t) => t.grid!))).toBe(false);
  });

  it("clampTileGridPlacement treats non-finite column as zero", () => {
    const t = tile("n", { col: Number.NaN, row: 0, colSpan: 6, rowSpan: 1 });
    expect(clampTileGridPlacement(t).col).toBe(0);
  });

  it("clampTileGridPlacement treats non-finite row as zero", () => {
    const t = tile("n", { col: 0, row: Number.NaN, colSpan: 6, rowSpan: 1 });
    expect(clampTileGridPlacement(t).row).toBe(0);
  });
});
