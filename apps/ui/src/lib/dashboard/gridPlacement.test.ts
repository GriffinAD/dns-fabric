import { describe, expect, it } from "vitest";

import {
  alignGaugeColumnCount,
  clampGridColSpan,
  clampGridRowSpan,
  clampTileGridPlacement,
  gridAreaStyle,
  gridColumnSpanStyle,
  groupGridAreaStyle,
  groupGridColumnSpanStyle,
  groupInnerWidthInPhysicalTracks,
  hasCompleteGrid,
  layoutWithGrid,
  normalizeDashboardTiles,
  packRootLayoutItems,
  packTilesToGrid,
  packTilesWithFixedAndFloating,
  placementsOverlap,
  reorderRootLayoutItemsPreservingSlotOrigins,
  reorderTilesPreservingSlotOrigins,
  tileColSpan,
} from "./gridPlacement";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV1,
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
  it("packs a classic flat 8-tile set (four perf 1-cols, then default 6-col DHCP/discovery rows)", () => {
    const packed = packTilesToGrid(flatDefaultLikePackOrder);
    expect(packed[0].grid).toEqual({ col: 0, row: 0, colSpan: 1, rowSpan: 1 });
    expect(packed[1].grid).toEqual({ col: 1, row: 0, colSpan: 1, rowSpan: 1 });
    expect(packed[2].grid).toEqual({ col: 2, row: 0, colSpan: 1, rowSpan: 1 });
    expect(packed[3].grid).toEqual({ col: 3, row: 0, colSpan: 1, rowSpan: 1 });
    /* Default colSpan for dhcp.* / discovery is 6 when no explicit grid (not 3). */
    expect(packed[4].grid).toEqual({ col: 4, row: 0, colSpan: 6, rowSpan: 1 });
    expect(packed[5].grid).toEqual({ col: 0, row: 1, colSpan: 6, rowSpan: 1 });
    expect(packed[6].grid).toEqual({ col: 6, row: 1, colSpan: 6, rowSpan: 1 });
    expect(packed[7].grid).toEqual({ col: 0, row: 2, colSpan: 6, rowSpan: 1 });
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

describe("alignGaugeColumnCount", () => {
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

  it("at root, width in root cols equals T; in a G-wide group, (G×T)/12 (not T alone)", () => {
    expect(alignGaugeColumnCount(null, tileSpanT(12))).toBe(12);
    expect(alignGaugeColumnCount(null, tileSpanT(3))).toBe(3);
    expect(alignGaugeColumnCount(groupRootW(12), tileSpanT(12))).toBe(12);
    /* Full-width in 6 root cols → 6 align tracks, not 12, so sub-columns are one root wide. */
    expect(alignGaugeColumnCount(groupRootW(6), tileSpanT(12))).toBe(6);
    /* T=3 in 6-wide group: 3×6/12 = 1.5 → 2 */
    expect(alignGaugeColumnCount(groupRootW(6), tileSpanT(3))).toBe(2);
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
  it("G=12 matches the root grid helpers", () => {
    const g: GridPlacement = { col: 0, row: 0, colSpan: 6, rowSpan: 1 };
    expect(groupGridAreaStyle(g, 12)).toBe(gridAreaStyle(g));
    const tile: DashboardTile = {
      id: "x",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
    };
    expect(groupGridColumnSpanStyle(tile, 12)).toBe(gridColumnSpanStyle(tile));
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

describe("groupInnerWidthInPhysicalTracks", () => {
  it("maps 1–12 contract to min(T, G) tracks (one track = one main-dashboard column width)", () => {
    expect(groupInnerWidthInPhysicalTracks(4, 6)).toBe(4);
    expect(groupInnerWidthInPhysicalTracks(8, 6)).toBe(6);
    expect(groupInnerWidthInPhysicalTracks(6, 6)).toBe(6);
    expect(groupInnerWidthInPhysicalTracks(5, 6)).toBe(5);
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
      "grid-column: span 12; grid-row: span 1;",
    );
    expect(gridColumnSpanStyle(base("perf.cpu"))).toBe(
      "grid-column: span 1; grid-row: span 1;",
    );
    expect(gridColumnSpanStyle(base("perf.ram"))).toBe(
      "grid-column: span 1; grid-row: span 1;",
    );
    expect(gridColumnSpanStyle(base("dhcp.pools"))).toBe(
      "grid-column: span 6; grid-row: span 1;",
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
      grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
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

  it("swaps the outer root slots of two complete groups", () => {
    const g1: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
      children: [],
    };
    const g2: DashboardGroup = {
      kind: "group",
      id: "g2",
      showBorder: true,
      grid: { col: 0, row: 1, colSpan: 12, rowSpan: 1 },
      children: [],
    };
    const prev: RootLayoutItem[] = [g1, g2];
    const out = reorderRootLayoutItemsPreservingSlotOrigins(prev, [g2, g1]);
    expect(out[0]!.id).toBe("g2");
    expect(out[0]!.grid?.row).toBe(0);
    expect(out[1]!.id).toBe("g1");
    expect(out[1]!.grid?.row).toBe(1);
  });

  it("updates two groups in sameSequence without permuting children", () => {
    const g1: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
      children: [],
    };
    const g2: DashboardGroup = {
      kind: "group",
      id: "g2",
      showBorder: true,
      grid: { col: 0, row: 1, colSpan: 12, rowSpan: 1 },
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
    expect(next.version).toBe(2);
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
      grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
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

  it("preserveRootPlacementIfComplete falls back to full pack when root placements overlap", () => {
    const a: RootLayoutItem = {
      kind: "tile",
      id: "a",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
    };
    const b: RootLayoutItem = {
      kind: "tile",
      id: "b",
      pluginId: "perf.ram",
      hostControl: "single-panel",
      displayMode: "compact",
      grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
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
