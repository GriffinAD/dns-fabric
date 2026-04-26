import { describe, expect, it } from "vitest";

import { alignPerfGridAlignment } from "./alignPerfGridAlignment";
import {
  clampGridColSpan,
  clampGridRowSpan,
  clampGroupChildGridPlacement,
  clampGroupChildStripOriginCol,
  clampTileGridPlacement,
  gridAreaStyle,
  gridColumnSpanStyle,
  GRID_COLUMNS,
  groupEditInnerColumnCount,
  groupGridAreaStyle,
  groupGridColumnSpanStyle,
  groupInnerWidthInPhysicalTracks,
  hasCompleteGrid,
  isCompleteGroupChildGrid,
  commitGroupInnerRowWraps,
  layoutWithGrid,
  normalizeDashboardTiles,
  packGroupChildrenNoWrapStripInOrder,
  packGroupChildrenRowWrapInOrder,
  packRootLayoutItems,
  stripInnerPhysicalTrackCount,
  packTilesToGrid,
  packTilesWithFixedAndFloating,
  placementForNewEmptyNestedGroup,
  placementsOverlap,
  reorderRootLayoutItemsPreservingSlotOrigins,
  reorderTilesPreservingSlotOrigins,
  tileColSpan,
} from "./gridPlacement";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV1,
  DashboardLayoutV3,
  GridPlacement,
  RootLayoutItem,
  DashboardTile,
} from "./types";

const flatDefaultLikePackOrder: DashboardTile[] = [
  { id: "1", pluginId: "perf.cpu", hostControl: "single-panel", displayMode: "compact" },
  { id: "2", pluginId: "perf.ram", hostControl: "single-panel", displayMode: "compact" },
  { id: "3", pluginId: "perf.network", hostControl: "single-panel", displayMode: "compact" },
  { id: "4", pluginId: "perf.disk", hostControl: "single-panel", displayMode: "compact" },
  { id: "5", pluginId: "dhcp.pools", hostControl: "single-panel", displayMode: "full" },
  { id: "6", pluginId: "discovery.records", hostControl: "single-panel", displayMode: "full" },
  { id: "7", pluginId: "dhcp.clients", hostControl: "single-panel", displayMode: "full" },
  { id: "8", pluginId: "dhcp.reservations", hostControl: "single-panel", displayMode: "full" },
];

describe("packTilesToGrid", () => {
  it("packs a classic flat 8-tile set (four perf 1-cols, then default half-width DHCP/discovery rows)", () => {
    const packed = packTilesToGrid(flatDefaultLikePackOrder);
    expect(packed[0].grid).toEqual({ col: 0, row: 0, colSpan: 1, rowSpan: 1 });
    expect(packed[1].grid).toEqual({ col: 1, row: 0, colSpan: 1, rowSpan: 1 });
    expect(packed[2].grid).toEqual({ col: 2, row: 0, colSpan: 1, rowSpan: 1 });
    expect(packed[3].grid).toEqual({ col: 3, row: 0, colSpan: 1, rowSpan: 1 });
    /* Default colSpan for dhcp.* / discovery is 10 when no explicit grid (`tileColSpanForPlugin`). */
    expect(packed[4].grid).toEqual({ col: 4, row: 0, colSpan: 10, rowSpan: 1 });
    expect(packed[5].grid).toEqual({ col: 0, row: 1, colSpan: 10, rowSpan: 1 });
    expect(packed[6].grid).toEqual({ col: 10, row: 1, colSpan: 10, rowSpan: 1 });
    expect(packed[7].grid).toEqual({ col: 0, row: 2, colSpan: 10, rowSpan: 1 });
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
    expect(packed[0].grid).toEqual({ col: 0, row: 0, colSpan: 10, rowSpan: 1 });
    expect(packed[1].grid).toEqual({ col: 10, row: 0, colSpan: 10, rowSpan: 1 });
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
    expect(packed[1].grid).toEqual({ col: 0, row: 1, colSpan: 20, rowSpan: 1 });
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
        grid: { col: 0, row: 0, colSpan: 20, rowSpan: 10 },
      },
      {
        id: "cli",
        pluginId: "dhcp.clients",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 20, rowSpan: 10 },
      },
    ];
    const packed = packTilesToGrid(tiles);
    expect(packed[0].grid).toMatchObject({ col: 0, row: 0, colSpan: 20, rowSpan: 10 });
    expect(packed[1].grid).toMatchObject({ col: 0, row: 10, colSpan: 20, rowSpan: 10 });
  });

  it("normalize defragments a hole between two rowSpan-1 tiles on the same row", () => {
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
    expect(norm[1].grid).toMatchObject({ col: 1, row: 0, colSpan: 1, rowSpan: 1 });
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

describe("alignPerfGridAlignment", () => {
  const tileSpanT = (T: number): DashboardTile => ({
    id: "t",
    pluginId: "perf.cpu",
    hostControl: "single-panel",
    displayMode: "compact",
    grid: { col: 0, row: 0, colSpan: T, rowSpan: 1 },
  });

  const groupRootW = (w: number): DashboardGroup => ({
    kind: "group",
    id: "g",
    showBorder: true,
    grid: { col: 0, row: 0, colSpan: w, rowSpan: 1 },
    children: [],
  });

  it("at root, width in root cols equals T; in a G-wide group, (G×T)/GRID_COLUMNS (not T alone)", () => {
    expect(alignPerfGridAlignment(null, tileSpanT(20))).toBe(20);
    expect(alignPerfGridAlignment(null, tileSpanT(3))).toBe(3);
    expect(alignPerfGridAlignment(groupRootW(20), tileSpanT(20))).toBe(20);
    /* Full-width in 6 root cols → 6 align tracks, not GRID_COLUMNS, so sub-columns are one root wide. */
    expect(alignPerfGridAlignment(groupRootW(6), tileSpanT(20))).toBe(6);
    /* T=3 in 6-wide group: 3×6/20 = 0.9 → 1 */
    expect(alignPerfGridAlignment(groupRootW(6), tileSpanT(3))).toBe(1);
  });
});

describe("gridAreaStyle", () => {
  it("emits 1-based CSS grid lines", () => {
    expect(gridAreaStyle({ col: 0, row: 1, colSpan: 6, rowSpan: 1 })).toBe(
      "grid-column: 1 / span 6; grid-row: 2 / span 1;",
    );
  });
});

describe("groupGridAreaStyle and groupGridColumnSpanStyle", () => {
  it("G=GRID_COLUMNS matches the root grid helpers", () => {
    const g: GridPlacement = { col: 0, row: 0, colSpan: 6, rowSpan: 1 };
    expect(groupGridAreaStyle(g, GRID_COLUMNS)).toBe(gridAreaStyle(g));
    const tile: DashboardTile = {
      id: "x",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
    };
    expect(groupGridColumnSpanStyle(tile, GRID_COLUMNS)).toBe(gridColumnSpanStyle(tile));
  });

  it("G=6 uses six physical inner columns: full 12-based span matches six dashboard column widths", () => {
    expect(groupGridAreaStyle({ col: 0, row: 0, colSpan: 12, rowSpan: 1 }, 6)).toBe(
      "grid-column: 1 / span 6; grid-row: 1 / span 1;",
    );
  });

  it("G=6: span-6 in the 12 model uses all six physical tracks (half dashboard, full group)", () => {
    expect(groupGridAreaStyle({ col: 0, row: 0, colSpan: 6, rowSpan: 1 }, 6)).toBe(
      "grid-column: 1 / span 6; grid-row: 1 / span 1;",
    );
  });

  it("G=6: default span-6 (dhcp) fills the group (six tracks = six dashboard col widths)", () => {
    const tile: DashboardTile = {
      id: "x",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
    };
    expect(groupGridColumnSpanStyle(tile, 6)).toBe("grid-column: span 6; grid-row: span 1;");
  });
});

describe("stripInnerPhysicalTrackCount", () => {
  it("uses at least one track for fractional or NaN inputs", () => {
    expect(stripInnerPhysicalTrackCount(0.4)).toBe(1);
    expect(stripInnerPhysicalTrackCount(Number.NaN)).toBe(1);
  });

  it("caps at GRID_COLUMNS", () => {
    expect(stripInnerPhysicalTrackCount(10_000)).toBe(GRID_COLUMNS);
  });
});

describe("groupInnerWidthInPhysicalTracks", () => {
  it("maps contract colSpan to min(T, G) tracks (one track = one main-dashboard column width)", () => {
    expect(groupInnerWidthInPhysicalTracks(4, 6)).toBe(4);
    expect(groupInnerWidthInPhysicalTracks(8, 6)).toBe(6);
    expect(groupInnerWidthInPhysicalTracks(6, 6)).toBe(6);
    expect(groupInnerWidthInPhysicalTracks(5, 6)).toBe(5);
  });
});

const wrapTile = (
  id: string,
  colSpan: number,
  pluginId = "dhcp.pools",
): DashboardTile => ({
  id,
  pluginId,
  hostControl: "single-panel",
  displayMode: "full",
  grid: { col: 0, row: 0, colSpan, rowSpan: 1 },
});

describe("packGroupChildrenRowWrapInOrder", () => {
  it("returns an empty child list unchanged", () => {
    expect(packGroupChildrenRowWrapInOrder([], 6)).toEqual([]);
  });

  it("treats innerColumns 0 as 1 when computing G", () => {
    const out = packGroupChildrenRowWrapInOrder([wrapTile("a", 1)], 0);
    expect(out[0]!.grid).toMatchObject({ col: 0, row: 0, colSpan: 1, rowSpan: 1 });
  });

  it("wraps the next tile to a new row at col 0 when the row is full (G=4, widths 3+3)", () => {
    const out = packGroupChildrenRowWrapInOrder([wrapTile("a", 3), wrapTile("b", 3)], 4);
    expect(out[0]!.grid).toMatchObject({ col: 0, row: 0, colSpan: 3, rowSpan: 1 });
    expect(out[1]!.grid).toMatchObject({ col: 0, row: 1, colSpan: 3, rowSpan: 1 });
  });
});

describe("packGroupChildrenNoWrapStripInOrder", () => {
  it("returns an empty list unchanged", () => {
    expect(packGroupChildrenNoWrapStripInOrder([], 10)).toEqual([]);
  });

  it("treats non-finite innerColumns as G=1 after floor", () => {
    const t = wrapTile("a", 2);
    const out = packGroupChildrenNoWrapStripInOrder([t], Number.NaN);
    expect(out[0]!.grid).toMatchObject({ col: 0, row: 0, colSpan: 2, rowSpan: 1 });
  });

  it("keeps every tile on strip row 0 (no root 20-col row wrap) so a second plugin is not row=1", () => {
    const t1 = wrapTile("a", 12);
    const t2: DashboardTile = {
      id: "b",
      pluginId: "perf.ram",
      hostControl: "single-panel",
      displayMode: "full",
    };
    const out = packGroupChildrenNoWrapStripInOrder([t1, t2], 10);
    expect(out[0]!.grid).toMatchObject({ col: 0, row: 0, colSpan: 12, rowSpan: 1 });
    expect(out[1]!.grid).toMatchObject({ col: 10, row: 0, rowSpan: 1 });
  });
});

describe("commitGroupInnerRowWraps", () => {
  it("only rewrites children for groups with innerWrap", () => {
    const g1: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      innerWrap: true,
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
      children: [wrapTile("a", 3), wrapTile("b", 3)],
    };
    const g2: DashboardGroup = { ...g1, id: "g2", innerWrap: false };
    const out = commitGroupInnerRowWraps([g1, g2]);
    expect((out[0] as DashboardGroup).children[1]!.grid?.row).toBe(1);
    expect((out[1] as DashboardGroup).children[0]!.grid?.row).toBe(0);
  });

  it("recurses into nested innerWrap groups under a nowrap parent", () => {
    const inner: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      innerWrap: true,
      grid: { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
      children: [wrapTile("a", 5), wrapTile("b", 5)],
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 },
      children: [inner],
    };
    const out = commitGroupInnerRowWraps([outer]);
    const nested = (out[0] as DashboardGroup).children[0] as DashboardGroup;
    expect(nested.children[1]!.grid?.row).toBe(1);
  });

  it("leaves root-level tiles unchanged", () => {
    const t: RootLayoutItem = {
      kind: "tile",
      id: "solo",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "full",
    };
    expect(commitGroupInnerRowWraps([t])).toEqual([t]);
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
    expect(tileColSpan(base("perf.summary"))).toBe(20);
    expect(tileColSpan(base("perf.cpu"))).toBe(1);
    expect(tileColSpan(base("perf.ram"))).toBe(1);
    expect(tileColSpan(base("perf.network"))).toBe(1);
    expect(tileColSpan(base("perf.disk"))).toBe(1);
    expect(tileColSpan(base("dhcp.pools"))).toBe(10);
  });

  it("emits span-only grid-column and grid-row for auto placement", () => {
    expect(gridColumnSpanStyle(base("perf.summary"))).toBe(
      "grid-column: span 20; grid-row: span 1;",
    );
    expect(gridColumnSpanStyle(base("perf.cpu"))).toBe(
      "grid-column: span 1; grid-row: span 1;",
    );
    expect(gridColumnSpanStyle(base("perf.ram"))).toBe(
      "grid-column: span 1; grid-row: span 1;",
    );
    expect(gridColumnSpanStyle(base("dhcp.pools"))).toBe(
      "grid-column: span 10; grid-row: span 1;",
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
    expect(gridColumnSpanStyle(t)).toBe("grid-column: span 4; grid-row: span 2;");
  });
});

describe("reorderRootLayoutItemsPreservingSlotOrigins", () => {
  it("returns reordered item unchanged when id matches but kind mismatches in same order (corrupt state)", () => {
    const prev: RootLayoutItem[] = [t("xid", 0, 0, 6, 1)];
    const g: DashboardGroup = {
      kind: "group",
      id: "xid",
      showBorder: true,
      children: [],
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
    };
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, [g]);
    expect(out[0]).toBe(g);
  });

  it("preserves a group in sameSequence when previous outer grid was incomplete", () => {
    const gPrev: DashboardGroup = { kind: "group", id: "g1", showBorder: true, children: [] };
    const gReo: DashboardGroup = { kind: "group", id: "g1", showBorder: true, children: [] };
    const out = reorderRootLayoutItemsPreservingSlotOrigins([gPrev], [gReo]);
    expect((out[0] as DashboardGroup).grid).toBeUndefined();
  });
  const t = (id: string, c: number, r: number, cs: number, rs: number) =>
    ({
      kind: "tile" as const,
      id,
      pluginId: "dhcp.pools",
      hostControl: "single-panel" as const,
      displayMode: "full" as const,
      grid: { col: c, row: r, colSpan: cs, rowSpan: rs },
    }) satisfies RootLayoutItem;

  it("keeps the same list when reordered matches previous order and outer grids are complete", () => {
    const prev: RootLayoutItem[] = [t("a", 0, 0, 6, 1), t("b", 6, 0, 6, 1)];
    const reo = [structuredClone(prev[0]!), structuredClone(prev[1]!)] as RootLayoutItem[];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, reo);
    expect(out[0]!.grid?.col).toBe(0);
    expect(out[1]!.grid?.col).toBe(6);
  });

  it("permutes root slots when top-level order changes", () => {
    const prev: RootLayoutItem[] = [t("a", 0, 0, 6, 1), t("b", 6, 0, 6, 1)];
    const reo: RootLayoutItem[] = [prev[1]!, prev[0]!];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, reo);
    expect(out[0]!.id).toBe("b");
    expect(out[0]!.grid?.col).toBe(0);
    expect(out[1]!.id).toBe("a");
    expect(out[1]!.grid?.col).toBe(6);
  });

  it("repacks when previous root items lack complete outer grids", () => {
    const prev: RootLayoutItem[] = [
      { kind: "tile", id: "a", pluginId: "dhcp.pools", hostControl: "single-panel", displayMode: "full" },
      t("b", 6, 0, 6, 1),
    ];
    const reo: RootLayoutItem[] = [prev[1]!, prev[0]!];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, reo);
    expect(out.length).toBe(2);
  });

  it("repacks when root item count changes", () => {
    const prev: RootLayoutItem[] = [t("a", 0, 0, 6, 1)];
    const reo: RootLayoutItem[] = [t("a", 0, 0, 6, 1), t("b", 0, 0, 6, 1)];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, reo);
    expect(out.length).toBe(2);
  });

  it("in sameSequence clamps a tile when the previous slot had no complete grid", () => {
    const prev: RootLayoutItem[] = [
      { kind: "tile", id: "a", pluginId: "dhcp.pools", hostControl: "single-panel", displayMode: "full" },
    ];
    const reo: RootLayoutItem[] = [
      {
        kind: "tile",
        id: "a",
        pluginId: "dhcp.pools",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
      },
    ];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, reo);
    expect(out[0]!.grid!.colSpan).toBe(6);
  });

  it("in sameSequence uses previous effective spans when reordered tile has a non-root-complete grid", () => {
    const prev: RootLayoutItem[] = [
      {
        kind: "tile",
        id: "a",
        pluginId: "dhcp.pools",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 10, rowSpan: 1 },
      },
    ];
    const reo: RootLayoutItem[] = [
      {
        kind: "tile",
        id: "a",
        pluginId: "dhcp.pools",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 25, rowSpan: 1 },
      },
    ];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, reo);
    expect(out[0]!.kind).toBe("tile");
    if (out[0]!.kind === "tile") {
      expect(out[0].grid?.colSpan).toBe(10);
      expect(out[0].grid?.rowSpan).toBe(1);
    }
  });

  it("in sameSequence keeps previous col/row span when reordered item has no grid yet (stale dnd after tile save)", () => {
    const prev: RootLayoutItem[] = [
      {
        kind: "tile",
        id: "t-new",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
      },
    ];
    const reo: RootLayoutItem[] = [
      {
        kind: "tile",
        id: "t-new",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, reo);
    const g = (out[0] as { grid?: { colSpan: number; rowSpan: number } }).grid;
    expect(g?.colSpan).toBe(2);
    expect(g?.rowSpan).toBe(1);
  });

  it("swaps the outer root slots of two complete groups", () => {
    const g1: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [],
    };
    const g2: DashboardGroup = {
      kind: "group",
      id: "g2",
      showBorder: true,
      grid: { col: 0, row: 1, colSpan: 20, rowSpan: 1 },
      children: [],
    };
    const prev: RootLayoutItem[] = [g1, g2];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, [g2, g1]);
    expect(out[0]!.id).toBe("g2");
    expect(out[0]!.grid?.row).toBe(0);
    expect(out[1]!.id).toBe("g1");
    expect(out[1]!.grid?.row).toBe(1);
  });

  it("reorderRootLayoutItemsPreservingSlotOrigins handles groups whose children have no grid yet", () => {
    const gPrev: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "c",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
        },
      ],
    };
    const gReo = structuredClone(gPrev) as DashboardGroup;
    const out = reorderRootLayoutItemsPreservingSlotOrigins([gPrev], [gReo]);
    expect(out[0]?.kind).toBe("group");
  });

  it("updates two groups in sameSequence without permuting children", () => {
    const g1: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [],
    };
    const g2: DashboardGroup = {
      kind: "group",
      id: "g2",
      showBorder: true,
      grid: { col: 0, row: 1, colSpan: 20, rowSpan: 1 },
      children: [],
    };
    const prev: RootLayoutItem[] = [g1, g2];
    const reo = prev.map((x) => structuredClone(x)) as RootLayoutItem[];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, reo);
    expect(out[0]!.kind).toBe("group");
    expect(out[0]!.grid?.row).toBe(0);
  });
});

describe("packRootLayoutItems", () => {
  it("treats a root item without kind as a tile", () => {
    const raw = {
      id: "z",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
    } as unknown as RootLayoutItem;
    const out = packRootLayoutItems([raw]);
    expect(out[0]?.kind).toBe("tile");
  });

  it("applies root normalizeDashboardTiles to !innerWrap group children (no auto-wrap strip)", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g-nowrap",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "a",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
        },
      ],
    };
    const out = packRootLayoutItems([g]);
    expect(out[0]?.kind).toBe("group");
    if (out[0]?.kind === "group") {
      expect(out[0].children[0]?.grid).toBeDefined();
    }
  });

  it("strip-mixed nowrap repacks when a nested group has an invalid strip outer grid beside a tile", () => {
    const innerBad: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 25, rowSpan: 1 },
      children: [],
    };
    const tileOk: DashboardTile = {
      id: "t1",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [innerBad, tileOk],
    };
    const out = packRootLayoutItems([outer]);
    expect(out[0]?.kind).toBe("group");
    if (out[0]?.kind === "group") {
      expect(out[0].children).toHaveLength(2);
    }
  });

  it("strip-mixed nowrap repacks when a tile has a non-null but invalid inner strip grid beside a nested group", () => {
    const inner: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
      children: [],
    };
    const badTile: DashboardTile = {
      id: "bad",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 0, row: 0, colSpan: 25, rowSpan: 1 },
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [inner, badTile],
    };
    const out = packRootLayoutItems([outer]);
    expect(out[0]?.kind).toBe("group");
    if (out[0]?.kind === "group") {
      expect(out[0].children).toHaveLength(2);
      expect(out[0].children[0]?.grid?.col).toBe(0);
      expect(out[0].children[1]?.grid?.col).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("layoutWithGrid", () => {
  it("migrates v1 and returns v2 with packed items", () => {
    const base: DashboardLayoutV1 = {
      version: 1,
      tiles: [
        { id: "a", pluginId: "perf.cpu", hostControl: "single-panel", displayMode: "compact" },
      ],
    };
    const next = layoutWithGrid(base);
    expect(next.version).toBe(3);
    expect(next.items[0]?.kind).toBe("tile");
    if (next.items[0]?.kind === "tile") {
      expect(next.items[0].grid?.colSpan).toBe(1);
    }
  });

  it("preserveRootPlacementIfComplete keeps non-overlapping root placement and normalizes group children", () => {
    const t: RootLayoutItem = {
      kind: "tile",
      id: "t1",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
    };
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 6, row: 0, colSpan: 6, rowSpan: 1 },
      children: [
        {
          id: "c1",
          pluginId: "perf.ram",
          hostControl: "single-panel",
          displayMode: "compact",
        },
      ],
    };
    const next = layoutWithGrid({ version: 2, items: [t, g] }, { preserveRootPlacementIfComplete: true });
    expect(next.items[0]?.kind).toBe("tile");
    if (next.items[0]?.kind === "tile") {
      expect(next.items[0].grid).toMatchObject({ col: 0, row: 0, colSpan: 6, rowSpan: 1 });
    }
    expect(next.items[1]?.kind).toBe("group");
    if (next.items[1]?.kind === "group") {
      expect(next.items[1].grid).toMatchObject({ col: 6, row: 0, colSpan: 6, rowSpan: 1 });
      expect(next.items[1].children[0]?.grid).toBeDefined();
    }
  });

  it("preserveRootPlacementIfComplete does not reset group children that already have grid (e.g. after container span change)", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
      children: [
        {
          id: "c1",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
        },
      ],
    };
    const next = layoutWithGrid({ version: 2, items: [g] }, { preserveRootPlacementIfComplete: true });
    expect(next.items[0]?.kind).toBe("group");
    if (next.items[0]?.kind === "group") {
      expect(next.items[0].grid).toMatchObject({ col: 0, row: 0, colSpan: 6, rowSpan: 1 });
      const c0 = next.items[0].children[0];
      expect(c0?.grid?.colSpan).toBe(12);
    }
  });

  it("preserveRootPlacementIfComplete does not defragment inner group gaps (sibling col origins stay fixed)", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "c1",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
        },
        {
          id: "c2",
          pluginId: "perf.ram",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 4, row: 0, colSpan: 2, rowSpan: 1 },
        },
      ],
    };
    const next = layoutWithGrid({ version: 2, items: [g] }, { preserveRootPlacementIfComplete: true });
    expect(next.items[0]?.kind).toBe("group");
    if (next.items[0]?.kind === "group") {
      const c = next.items[0].children;
      expect(c[0]?.grid).toMatchObject({ col: 0, row: 0, colSpan: 2, rowSpan: 1 });
      expect(c[1]?.grid).toMatchObject({ col: 4, row: 0, colSpan: 2, rowSpan: 1 });
    }
  });

  it("preserve without editMode still repacks innerWrap group children via packGroupChildrenInLayout", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      innerWrap: true,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "c1",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        },
        {
          id: "c2",
          pluginId: "perf.ram",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 5, row: 0, colSpan: 1, rowSpan: 1 },
        },
      ],
    };
    const next = layoutWithGrid({ version: 2, items: [g] }, { preserveRootPlacementIfComplete: true });
    expect(next.items[0]?.kind).toBe("group");
    if (next.items[0]?.kind === "group") {
      expect(next.items[0].children).toHaveLength(2);
    }
  });

  it("preserve + editMode leaves innerWrap group children as-is (no re-pack in layoutWithGrid)", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      innerWrap: true,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "c1",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        },
      ],
    };
    const next = layoutWithGrid(
      { version: 2, items: [g] },
      { preserveRootPlacementIfComplete: true, editMode: true },
    );
    if (next.items[0]?.kind === "group") {
      expect(next.items[0].innerWrap).toBe(true);
      expect(next.items[0].children[0]?.grid).toEqual({ col: 0, row: 0, colSpan: 1, rowSpan: 1 });
    }
  });

  it("preserveRootPlacementIfComplete falls back to full pack when root placements overlap", () => {
    const a: RootLayoutItem = {
      kind: "tile",
      id: "a",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
    };
    const b: RootLayoutItem = {
      kind: "tile",
      id: "b",
      pluginId: "perf.ram",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
    };
    const out = layoutWithGrid({ version: 2, items: [a, b] }, { preserveRootPlacementIfComplete: true });
    expect(out.items.length).toBe(2);
    /* Second tile must be on a different row after pack (no same-cell overlap). */
    const g0 = out.items[0]?.kind === "tile" ? out.items[0].grid : null;
    const g1 = out.items[1]?.kind === "tile" ? out.items[1].grid : null;
    expect(g0 && g1 && (g0.row !== g1.row || g0.col !== g1.col)).toBe(true);
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

  it("hasCompleteGrid rejects column geometry outside the root grid", () => {
    expect(hasCompleteGrid(tile("a", { col: 14, row: 0, colSpan: 8, rowSpan: 1 }))).toBe(false);
  });

  it("placementsOverlap is false for separate rects and true when they intersect", () => {
    expect(placementsOverlap([])).toBe(false);
    expect(placementsOverlap([{ col: 0, row: 0, colSpan: 20, rowSpan: 1 }])).toBe(false);
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

  it("normalizeDashboardTiles repacks via packTilesWithFixedAndFloating when any tile lacks a complete grid", () => {
    const complete = tile("a", { col: 0, row: 0, colSpan: 10, rowSpan: 1 });
    const missing = tile("b", undefined);
    const out = normalizeDashboardTiles([complete, missing]);
    expect(out).toHaveLength(2);
    expect(out.every((t) => t.grid != null)).toBe(true);
  });

  it("normalizeDashboardTiles repacks when explicit layouts overlap", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 20, rowSpan: 1 });
    const b = tile("b", { col: 0, row: 0, colSpan: 20, rowSpan: 1 });
    const out = normalizeDashboardTiles([a, b]);
    expect(out[0].grid?.row !== out[1].grid?.row || out[0].grid?.col !== out[1].grid?.col).toBe(true);
  });

  it("normalizeDashboardTiles removes empty columns between rowSpan-1 tiles on the same row", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 4, rowSpan: 1 });
    const b = tile("b", { col: 4, row: 0, colSpan: 1, rowSpan: 1 });
    const c = tile("c", { col: 6, row: 0, colSpan: 1, rowSpan: 1 });
    const d = tile("d", { col: 8, row: 0, colSpan: 2, rowSpan: 1 });
    const out = normalizeDashboardTiles([a, b, c, d]);
    expect(out.find((t) => t.id === "b")?.grid?.col).toBe(4);
    expect(out.find((t) => t.id === "c")?.grid?.col).toBe(5);
    expect(out.find((t) => t.id === "d")?.grid?.col).toBe(6);
  });

  it("normalizeDashboardTiles defrag skips rows with a single span-1 tile", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 6, rowSpan: 1 });
    const b = tile("b", { col: 0, row: 1, colSpan: 6, rowSpan: 1 });
    const out = normalizeDashboardTiles([a, b]);
    expect(out).toHaveLength(2);
  });

  it("normalizeDashboardTiles defrag ignores tiles with rowSpan greater than 1 when scanning gaps", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 6, rowSpan: 2 });
    const b = tile("b", { col: 0, row: 2, colSpan: 6, rowSpan: 1 });
    const out = normalizeDashboardTiles([a, b]);
    expect(out.every((t) => t.grid != null)).toBe(true);
  });

  it("normalizeDashboardTiles leaves abutting same-row rowSpan-1 tiles unchanged (no internal hole)", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 1, rowSpan: 1 });
    const b = tile("b", { col: 1, row: 0, colSpan: 1, rowSpan: 1 });
    const norm = normalizeDashboardTiles([a, b]);
    expect(norm[0].grid).toMatchObject({ col: 0, row: 0, colSpan: 1 });
    expect(norm[1].grid).toMatchObject({ col: 1, row: 0, colSpan: 1, rowSpan: 1 });
  });

  it("packTilesWithFixedAndFloating places tiles without grid after fixed tiles", () => {
    const fixed = tile("f", { col: 0, row: 0, colSpan: 6, rowSpan: 1 });
    const floating = tile("g", undefined);
    const out = packTilesWithFixedAndFloating([fixed, floating]);
    expect(out).toHaveLength(2);
    expect(out[1].grid).toBeDefined();
  });

  it("packTilesWithFixedAndFloating falls back to pack when fixed footprints overlap", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 20, rowSpan: 1 });
    const b = tile("b", { col: 0, row: 0, colSpan: 20, rowSpan: 1 });
    const out = packTilesWithFixedAndFloating([a, b]);
    expect(placementsOverlap(out.map((t) => t.grid!))).toBe(false);
  });

  it("reorderTilesPreservingSlotOrigins repacks when tile counts differ", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 20, rowSpan: 1 });
    const b = tile("b", { col: 0, row: 1, colSpan: 20, rowSpan: 1 });
    const out = reorderTilesPreservingSlotOrigins([a], [a, b]);
    expect(out).toHaveLength(2);
  });

  it("reorderTilesPreservingSlotOrigins clamps when order unchanged but grid incomplete", () => {
    const incomplete = tile("x", undefined);
    const out = reorderTilesPreservingSlotOrigins([incomplete], [{ ...incomplete }]);
    expect(out[0].grid).toBeDefined();
  });

  it("reorderTilesPreservingSlotOrigins repacks when any previous tile lacked a grid", () => {
    const full = tile("a", { col: 0, row: 0, colSpan: 20, rowSpan: 1 });
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

  it("isCompleteGroupChildGrid (no wrap) allows col+colSpan past GRID_COLUMNS (strip)", () => {
    const g: GridPlacement = { col: 12, row: 0, colSpan: 1, rowSpan: 1 };
    expect(isCompleteGroupChildGrid(g, false)).toBe(true);
  });

  it("isCompleteGroupChildGrid (no wrap) rejects col+colSpan past max extent", () => {
    const g: GridPlacement = { col: 9990, row: 0, colSpan: 20, rowSpan: 1 };
    expect(isCompleteGroupChildGrid(g, false)).toBe(false);
  });

  it("groupEditInnerColumnCount extends past G when no-wrap children are wide on X", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
      children: [
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
          grid: { col: 20, row: 0, colSpan: 1, rowSpan: 1 },
        },
      ],
    };
    expect(groupEditInnerColumnCount(g)).toBe(21);
  });

  it("groupEditInnerColumnCount includes strip X extent even if row/rowSpan are not isComplete", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "a",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 14, row: -1, colSpan: 2, rowSpan: 1 },
        },
      ],
    };
    expect(groupEditInnerColumnCount(g)).toBe(20);
  });

  it("groupGridAreaStyle works with inner fr count above root width (editor strip)", () => {
    const g: GridPlacement = { col: 18, row: 0, colSpan: 2, rowSpan: 1 };
    const s = groupGridAreaStyle(g, 24);
    expect(s).toContain("grid-column: 19 / span 2");
  });

  it("reorderTilesPreservingSlotOrigins (no wrap) permutes on wide strip", () => {
    const a = tile("a", { col: 0, row: 0, colSpan: 1, rowSpan: 1 });
    const b = { ...a, id: "b", grid: { col: 12, row: 0, colSpan: 1, rowSpan: 1 } };
    const out = reorderTilesPreservingSlotOrigins([a, b], [b, a], false);
    expect(out[0]!.id).toBe("b");
    expect(out[0]!.grid!.col).toBe(0);
    expect(out[1]!.grid!.col).toBe(12);
  });

  it("clampGroupChildGridPlacement (wrap) delegates to clampTileGridPlacement", () => {
    const t: DashboardTile = {
      id: "x",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 3, row: 1, colSpan: 2, rowSpan: 1 },
    };
    expect(clampGroupChildGridPlacement(t, true)).toEqual(clampTileGridPlacement(t));
  });

  it("reorderTilesPreservingSlotOrigins (no wrap) handles previous tile without grid in same sequence", () => {
    const prev: DashboardTile = {
      id: "a",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
    };
    const reo: DashboardTile = { ...prev };
    const out = reorderTilesPreservingSlotOrigins([prev], [reo], false);
    expect(out[0]?.grid).toBeDefined();
  });

  it("packTilesWithFixedAndFloating wraps when the running column would exceed GRID_COLUMNS", () => {
    const w8: DashboardTile = {
      id: "w8",
      pluginId: "perf.summary",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: -1, row: 0, colSpan: 15, rowSpan: 1 },
    };
    const dhcp: DashboardTile = {
      id: "d",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
    };
    const out = packTilesWithFixedAndFloating([w8, dhcp]);
    expect(out).toHaveLength(2);
    expect(out[0]!.grid!.col).toBe(0);
    expect(out[1]!.grid!.col).toBe(0);
    expect(out[1]!.grid!.row).toBeGreaterThanOrEqual(out[0]!.grid!.row);
  });

  it("groupInnerWidthInPhysicalTracks treats non-finite inner columns as 1", () => {
    expect(groupInnerWidthInPhysicalTracks(6, Number.NaN)).toBe(1);
  });

  it("groupGridColumnSpanStyle falls back when inner column count is non-finite", () => {
    const t: DashboardTile = {
      id: "x",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
    };
    const s = groupGridColumnSpanStyle(t, Number.NaN);
    expect(s).toMatch(/grid-column: span \d+/);
  });

  it("clampGroupChildGridPlacement (no wrap) constrains to strip", () => {
    const t: DashboardTile = {
      id: "x",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 9999, row: 0, colSpan: 4, rowSpan: 1 },
    };
    const c = clampGroupChildGridPlacement(t, false);
    expect(c.col + c.colSpan).toBeLessThanOrEqual(10000);
  });

  it("isCompleteGroupChildGrid (no wrap) rejects non-numeric geometry fields", () => {
    expect(
      isCompleteGroupChildGrid({ col: "0" as unknown as number, row: 0, colSpan: 1, rowSpan: 1 }, false),
    ).toBe(false);
  });

  it("isCompleteGroupChildGrid (no wrap) rejects non-integer geometry", () => {
    expect(isCompleteGroupChildGrid({ col: 0, row: 0, colSpan: 1.5, rowSpan: 1 }, false)).toBe(false);
  });

  it("isCompleteGroupChildGrid rejects a missing placement object", () => {
    expect(isCompleteGroupChildGrid(null, false)).toBe(false);
    expect(isCompleteGroupChildGrid(undefined, true)).toBe(false);
  });

  it("isCompleteGroupChildGrid (wrap) delegates to root grid completeness rules", () => {
    expect(isCompleteGroupChildGrid({ col: 0, row: 0, colSpan: 1, rowSpan: 1 }, true)).toBe(true);
    expect(isCompleteGroupChildGrid({ col: 0, row: 0, colSpan: 21, rowSpan: 1 }, true)).toBe(false);
  });

  it("isCompleteGroupChildGrid (no wrap) rejects rowSpan above max", () => {
    expect(
      isCompleteGroupChildGrid({ col: 0, row: 0, colSpan: 1, rowSpan: 999 }, false),
    ).toBe(false);
  });

  it("clampGroupChildStripOriginCol treats non-finite column as 0", () => {
    expect(clampGroupChildStripOriginCol(Number.NaN, 4)).toBe(0);
  });

  it("groupEditInnerColumnCount returns outer span when innerWrap is true", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      innerWrap: true,
      grid: { col: 0, row: 0, colSpan: 7, rowSpan: 1 },
      children: [],
    };
    expect(groupEditInnerColumnCount(g)).toBe(7);
  });

  it("groupEditInnerColumnCount skips children with no grid when computing strip extent", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
      children: [
        {
          id: "nogrid",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
        },
      ],
    };
    expect(groupEditInnerColumnCount(g)).toBe(8);
  });

  it("groupEditInnerColumnCount skips invalid child grids when computing strip extent", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
      children: [
        {
          id: "bad",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 0, rowSpan: 1 },
        },
        {
          id: "ok",
          pluginId: "perf.ram",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
        },
      ],
    };
    expect(groupEditInnerColumnCount(g)).toBe(6);
  });

  it("groupGridAreaStyle uses full gridAreaStyle when inner track count is GRID_COLUMNS", () => {
    const g: GridPlacement = { col: 3, row: 1, colSpan: 4, rowSpan: 2 };
    expect(groupGridAreaStyle(g, GRID_COLUMNS)).toBe(gridAreaStyle(g));
  });

  it("groupGridAreaStyle coerces non-finite inner column counts to 1 before computing m", () => {
    const g: GridPlacement = { col: 0, row: 0, colSpan: 2, rowSpan: 1 };
    const s = groupGridAreaStyle(g, Number.POSITIVE_INFINITY);
    expect(s).toContain("grid-column:");
    expect(s).toContain("grid-row:");
  });

  it("groupGridAreaStyle treats innerColumns 0 like 1 for track count", () => {
    const g: GridPlacement = { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
    expect(groupGridAreaStyle(g, 0)).toContain("grid-column:");
  });

  it("groupGridAreaStyle clamps col when col is past inner track count", () => {
    const g: GridPlacement = { col: 10, row: 0, colSpan: 4, rowSpan: 1 };
    const s = groupGridAreaStyle(g, 8);
    expect(s).toContain("grid-column: 8 / span 1");
  });

  it("packTilesWithFixedAndFloating wraps floating row and resets col after filling the row", () => {
    const a = tile("a", undefined);
    const b = tile("b", undefined);
    const c = tile("c", undefined);
    const out = packTilesWithFixedAndFloating([a, b, c]);
    expect(out.every((t) => t.grid != null)).toBe(true);
    expect(out[0]!.grid!.row).toBe(out[1]!.grid!.row);
    expect(out[2]!.grid!.row).toBeGreaterThanOrEqual(out[1]!.grid!.row);
  });

  it("reorderRootLayoutItemsPreservingSlotOrigins repacks when permuted slots would overlap", () => {
    const rt = (
      id: string,
      c: number,
      r: number,
      cs: number,
      rs: number,
    ): RootLayoutItem => ({
      kind: "tile" as const,
      id,
      pluginId: "dhcp.pools",
      hostControl: "single-panel" as const,
      displayMode: "full" as const,
      grid: { col: c, row: r, colSpan: cs, rowSpan: rs },
    });
    const A = rt("a", 0, 0, 6, 1);
    const B = rt("b", 6, 0, 6, 1);
    const C = rt("c", 0, 1, 12, 1);
    const prev: RootLayoutItem[] = [A, B, C];
    const reordered: RootLayoutItem[] = [C, A, B];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, reordered);
    expect(placementsOverlap(out.map((it) => (it.kind === "tile" ? it.grid! : it.grid!)))).toBe(false);
  });

  it("reorderRootLayoutItemsPreservingSlotOrigins uses previous group grid when reordered outer grid is incomplete", () => {
    const gPrev: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
      children: [],
    };
    const gReo: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: Number.NaN, row: 0, colSpan: 6, rowSpan: 1 },
      children: [],
    };
    const out = reorderRootLayoutItemsPreservingSlotOrigins([gPrev], [gReo]);
    expect(out[0]?.kind).toBe("group");
    if (out[0]?.kind === "group") {
      expect(out[0].grid?.col).toBe(0);
    }
  });

  it("layoutWithGrid preserveRoot leaves an empty nowrap group with no children", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "empty",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [],
    };
    const next = layoutWithGrid({ version: 2, items: [g] }, { preserveRootPlacementIfComplete: true });
    expect(next.items[0]?.kind).toBe("group");
    if (next.items[0]?.kind === "group") {
      expect(next.items[0].children).toEqual([]);
    }
  });

  it("layoutWithGrid preserveRoot repacks nowrap children when clamped strip placements overlap", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g-overlap",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "p1",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 10, rowSpan: 1 },
        },
        {
          id: "p2",
          pluginId: "perf.ram",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 5, row: 0, colSpan: 10, rowSpan: 1 },
        },
      ],
    };
    const next = layoutWithGrid({ version: 2, items: [g] }, { preserveRootPlacementIfComplete: true });
    expect(next.items[0]?.kind).toBe("group");
    if (next.items[0]?.kind === "group") {
      expect(placementsOverlap(next.items[0].children.map((c) => c.grid!))).toBe(false);
    }
  });

  it("layoutWithGrid preserveRoot falls back when packed root geoms overlap", () => {
    const t: RootLayoutItem = {
      kind: "tile",
      id: "t1",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
    };
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "c1",
          pluginId: "perf.ram",
          hostControl: "single-panel",
          displayMode: "compact",
        },
      ],
    };
    const next = layoutWithGrid({ version: 2, items: [t, g] }, { preserveRootPlacementIfComplete: true });
    expect(placementsOverlap(next.items.map((it) => (it.kind === "tile" ? it.grid! : it.grid!)))).toBe(
      false,
    );
  });

  it("packRootLayoutItems uses rowSpan 1 when nowrap group children lack grids", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "a",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
        },
      ],
    };
    const out = packRootLayoutItems([g]);
    expect(out[0]?.kind).toBe("group");
    if (out[0]?.kind === "group") {
      expect(out[0].grid?.rowSpan).toBeGreaterThanOrEqual(1);
    }
  });

  it("packRootLayoutItems runs row-wrap for innerWrap groups", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      innerWrap: true,
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 2 },
      children: [
        {
          id: "a",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
        },
        {
          id: "b",
          pluginId: "perf.ram",
          hostControl: "single-panel",
          displayMode: "compact",
        },
      ],
    };
    const out = packRootLayoutItems([g]);
    expect(out[0]?.kind).toBe("group");
    if (out[0]?.kind === "group") {
      expect(out[0].children[0]?.grid?.row).toBeDefined();
      expect(out[0].children[1]?.grid?.row).toBeDefined();
    }
  });

  it("packRootLayoutItems repacks mixed nested nowrap group + sibling tile when the tile lacks a grid", () => {
    const inner: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 10, rowSpan: 2 },
      children: [
        {
          id: "t1",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "full",
          grid: { col: 0, row: 0, colSpan: 5, rowSpan: 1 },
        },
      ],
    };
    const loose = {
      id: "t2",
      pluginId: "perf.ram",
      hostControl: "single-panel" as const,
      displayMode: "compact" as const,
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 3 },
      children: [inner, loose],
    };
    const out = packRootLayoutItems([outer]);
    expect(out[0]?.kind).toBe("group");
    if (out[0]?.kind === "group") {
      const c2 = out[0].children[1];
      expect(c2 && "pluginId" in c2).toBe(true);
      if (c2 && "pluginId" in c2 && c2.grid) {
        expect(c2.grid.row).toBe(0);
        expect(c2.grid.col).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("packRootLayoutItems normalizes nowrap group children that overlap after clamp", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
      children: [
        {
          id: "x",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
        },
        {
          id: "y",
          pluginId: "perf.ram",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
        },
      ],
    };
    const out = packRootLayoutItems([g]);
    expect(out[0]?.kind).toBe("group");
    if (out[0]?.kind === "group") {
      expect(placementsOverlap(out[0].children.map((c) => c.grid!))).toBe(false);
    }
  });

  it("layoutWithGrid handles v3 nested group with incomplete inner group grid for row span", () => {
    const v3: DashboardLayoutV3 = {
      version: 3,
      items: [
        {
          kind: "group",
          id: "outer",
          showBorder: true,
          innerWrap: false,
          grid: { col: 0, row: 0, colSpan: 20, rowSpan: 3 },
          children: [
            {
              kind: "group",
              id: "inner",
              showBorder: true,
              innerWrap: false,
              children: [
                {
                  id: "t1",
                  pluginId: "perf.cpu",
                  hostControl: "single-panel",
                  displayMode: "full",
                  grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
                },
              ],
            },
          ],
        },
      ],
    };
    const next = layoutWithGrid(v3, { preserveRootPlacementIfComplete: true });
    expect(next.version).toBe(3);
    const outer = next.items[0];
    expect(outer?.kind).toBe("group");
  });

  it("layoutWithGrid packs v3 nested nowrap groups under preserveRootPlacementIfComplete", () => {
    const v3: DashboardLayoutV3 = {
      version: 3,
      items: [
        {
          kind: "group",
          id: "outer",
          showBorder: true,
          innerWrap: false,
          grid: { col: 0, row: 0, colSpan: 20, rowSpan: 4 },
          children: [
            {
              kind: "group",
              id: "inner",
              showBorder: true,
              innerWrap: false,
              grid: { col: 0, row: 0, colSpan: 12, rowSpan: 2 },
              children: [
                {
                  id: "t1",
                  pluginId: "perf.cpu",
                  hostControl: "single-panel",
                  displayMode: "full",
                  grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
                },
              ],
            },
          ],
        },
      ],
    };
    const next = layoutWithGrid(v3, { preserveRootPlacementIfComplete: true });
    expect(next.version).toBe(3);
    const outer = next.items[0];
    expect(outer?.kind).toBe("group");
    if (outer?.kind === "group") {
      expect(outer.children[0]?.id).toBe("inner");
    }
  });

  it("groupEditInnerColumnCount uses nested innerCols when child group has no grid", () => {
    const nested: DashboardGroup = {
      kind: "group",
      id: "nested",
      showBorder: true,
      innerWrap: false,
      children: [
        {
          id: "u",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
        },
      ],
    };
    const g: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 10, rowSpan: 1 },
      children: [nested],
    };
    expect(groupEditInnerColumnCount(g)).toBeGreaterThanOrEqual(10);
  });

  it("groupEditInnerColumnCount skips nested group child grids that fail integer span checks", () => {
    const nested: DashboardGroup = {
      kind: "group",
      id: "nested",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 1.5 as unknown as number, rowSpan: 1 },
      children: [
        {
          id: "u",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
        },
      ],
    };
    const g: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 10, rowSpan: 1 },
      children: [nested],
    };
    expect(groupEditInnerColumnCount(g)).toBeGreaterThanOrEqual(10);
  });

  it("groupEditInnerColumnCount extends maxEnd for nested group with wide grid", () => {
    const nested: DashboardGroup = {
      kind: "group",
      id: "nested",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
      children: [
        {
          id: "u",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
        },
      ],
    };
    const g: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      innerWrap: false,
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
      children: [nested],
    };
    expect(groupEditInnerColumnCount(g)).toBeGreaterThanOrEqual(8);
  });

  describe("placementForNewEmptyNestedGroup", () => {
    it("uses half parent outer col span with no siblings", () => {
      const parent: DashboardGroup = {
        kind: "group",
        id: "p",
        showBorder: true,
        innerWrap: false,
        grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
        children: [],
      };
      expect(placementForNewEmptyNestedGroup(parent)).toEqual({
        col: 0,
        row: 0,
        colSpan: 6,
        rowSpan: 1,
      });
    });

    it("starts after sibling nested group with valid strip grid", () => {
      const inner: DashboardGroup = {
        kind: "group",
        id: "inner",
        showBorder: true,
        grid: { col: 0, row: 0, colSpan: 5, rowSpan: 1 },
        children: [],
      };
      const parent: DashboardGroup = {
        kind: "group",
        id: "p",
        showBorder: true,
        innerWrap: false,
        grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
        children: [inner],
      };
      expect(placementForNewEmptyNestedGroup(parent)).toEqual({
        col: 5,
        row: 0,
        colSpan: 10,
        rowSpan: 1,
      });
    });

    it("starts after sibling strip placement when it still fits GRID_COLUMNS", () => {
      const tile: DashboardTile = {
        id: "t",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "compact",
        grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
      };
      const parent: DashboardGroup = {
        kind: "group",
        id: "p",
        showBorder: true,
        innerWrap: false,
        grid: { col: 0, row: 0, colSpan: 14, rowSpan: 1 },
        children: [tile],
      };
      expect(placementForNewEmptyNestedGroup(parent)).toEqual({
        col: 6,
        row: 0,
        colSpan: 7,
        rowSpan: 1,
      });
    });

    it("ignores sibling nested group without a complete strip placement", () => {
      const innerIncomplete: DashboardGroup = {
        kind: "group",
        id: "inner",
        showBorder: true,
        grid: { col: 0, row: 0, colSpan: 25, rowSpan: 1 },
        children: [],
      };
      const parent: DashboardGroup = {
        kind: "group",
        id: "p",
        showBorder: true,
        innerWrap: false,
        grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
        children: [innerIncomplete],
      };
      expect(placementForNewEmptyNestedGroup(parent)).toEqual({
        col: 0,
        row: 0,
        colSpan: 10,
        rowSpan: 1,
      });
    });

    it("ignores sibling tile without a complete strip placement", () => {
      const tileBad: DashboardTile = {
        id: "t",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "compact",
        grid: { col: 0, row: 0, colSpan: 99, rowSpan: 1 },
      };
      const parent: DashboardGroup = {
        kind: "group",
        id: "p",
        showBorder: true,
        innerWrap: false,
        grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
        children: [tileBad],
      };
      expect(placementForNewEmptyNestedGroup(parent)).toEqual({
        col: 0,
        row: 0,
        colSpan: 10,
        rowSpan: 1,
      });
    });

    it("wraps to next row when nextCol + halfSpan would exceed GRID_COLUMNS", () => {
      const t1: DashboardTile = {
        id: "a",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "compact",
        grid: { col: 0, row: 0, colSpan: 10, rowSpan: 1 },
      };
      const t2: DashboardTile = {
        id: "b",
        pluginId: "perf.ram",
        hostControl: "single-panel",
        displayMode: "compact",
        grid: { col: 10, row: 0, colSpan: 10, rowSpan: 1 },
      };
      const parent: DashboardGroup = {
        kind: "group",
        id: "p",
        showBorder: true,
        innerWrap: false,
        grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
        children: [t1, t2],
      };
      expect(placementForNewEmptyNestedGroup(parent)).toEqual({
        col: 0,
        row: 1,
        colSpan: 10,
        rowSpan: 1,
      });
    });
  });
});
