import { describe, expect, it } from "vitest";

import {
  migrateV1ToV2,
  ensureLayoutV2,
  dedupeLayoutV2ItemIds,
  iterateTilesInLayout,
  findTileInLayout,
  mapTileInLayout,
  mapRootItemsReplaceGroup,
  moveTileToParent,
  removeTileFromAnywhere,
  dedupeById,
} from "./layoutTree";
import type { DashboardGroup, DashboardLayoutV1, DashboardLayoutV2, DashboardTile, RootLayoutItem } from "./types";
import { isLayoutV2 } from "./types";

const baseTile = (id: string, plugin: string, rowPanel?: string): DashboardTile => ({
  id,
  pluginId: plugin,
  hostControl: "single-panel",
  displayMode: "compact",
  ...(rowPanel ? { rowPanel } : {}),
});

describe("layoutTree", () => {
  it("dedupeById keeps first occurrence of duplicate ids", () => {
    const a = { id: "x", a: 1 } as { id: string; a: number };
    const a2 = { id: "x", a: 2 } as { id: string; a: number };
    const b = { id: "y", a: 3 } as { id: string; a: number };
    expect(dedupeById([a, a2, b])).toEqual([a, b]);
  });

  it("ensureLayoutV2 passes through v2", () => {
    const v2: DashboardLayoutV2 = { version: 2, items: [{ kind: "tile", ...baseTile("a", "dhcp.pools") }] };
    expect(ensureLayoutV2(v2)).toBe(v2);
  });

  it("ensureLayoutV2 dedupes duplicate group child ids (first wins)", () => {
    const dupId = "tile-dup-1";
    const t1: DashboardTile = { ...baseTile(dupId, "perf.cpu"), displayMode: "full" };
    const t2: DashboardTile = { ...baseTile(dupId, "perf.ram"), displayMode: "full" };
    const g: DashboardGroup = {
      kind: "group",
      id: "g1",
      showBorder: true,
      children: [t1, t2],
      grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
    };
    const v2: DashboardLayoutV2 = { version: 2, items: [g] };
    const out = ensureLayoutV2(v2);
    expect(out).not.toBe(v2);
    const og = out.items[0];
    expect(og?.kind).toBe("group");
    if (og?.kind === "group") {
      expect(og.children).toEqual([t1]);
    }
  });

  it("dedupeLayoutV2ItemIds dedupes root items", () => {
    const a: RootLayoutItem = { kind: "tile", ...baseTile("same", "perf.cpu") };
    const b: RootLayoutItem = { kind: "tile", ...baseTile("same", "perf.ram"), displayMode: "full" };
    const out = dedupeLayoutV2ItemIds({ version: 2, items: [a, b] });
    expect(out.items).toEqual([a]);
  });

  it("ensureLayoutV2 dedupes duplicate root tile ids (v2)", () => {
    const a: RootLayoutItem = { kind: "tile", ...baseTile("same", "perf.cpu") };
    const b: RootLayoutItem = { kind: "tile", ...baseTile("same", "perf.ram"), displayMode: "full" };
    const v2: DashboardLayoutV2 = { version: 2, items: [a, b] };
    const out = ensureLayoutV2(v2);
    expect(out.items).toEqual([a]);
  });

  it("ensureLayoutV2 migrates v1 and dedupes when two root tiles share an id", () => {
    const v1: DashboardLayoutV1 = {
      version: 1,
      tiles: [
        { ...baseTile("twin", "perf.cpu"), grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } },
        { ...baseTile("twin", "perf.ram"), displayMode: "full", grid: { col: 4, row: 0, colSpan: 4, rowSpan: 1 } },
      ],
    };
    const out = ensureLayoutV2(v1);
    expect(isLayoutV2(out)).toBe(true);
    expect(out.items.length).toBe(1);
    expect(out.items[0]?.kind).toBe("tile");
  });

  it("ensureLayoutV2 migrates v1 tiles", () => {
    const v1: DashboardLayoutV1 = {
      version: 1,
      tiles: [baseTile("x", "perf.cpu")],
    };
    const v2 = ensureLayoutV2(v1);
    expect(isLayoutV2(v2)).toBe(true);
    expect(v2.items.length).toBe(1);
    expect(v2.items[0]?.kind).toBe("tile");
  });

  it("migrateV1ToV2 groups rowPanel and translates inner grids", () => {
    const tiles: DashboardTile[] = [
      { ...baseTile("a", "perf.cpu", "p1"), grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } },
      { ...baseTile("b", "perf.ram", "p1"), grid: { col: 4, row: 0, colSpan: 2, rowSpan: 1 } },
      { ...baseTile("c", "dhcp.pools"), grid: { col: 0, row: 1, colSpan: 6, rowSpan: 1 } },
    ];
    const items = migrateV1ToV2(tiles);
    expect(items.length).toBe(2);
    const group = items.find((i) => i.kind === "group") as DashboardGroup | undefined;
    expect(group?.children.length).toBe(2);
    expect(group?.children[0]?.grid?.col).toBe(0);
    expect(group?.children[1]?.grid?.col).toBe(4);
  });

  it("iterateTilesInLayout walks root tiles and group children", () => {
    const items = migrateV1ToV2([
      baseTile("a", "perf.cpu"),
      { ...baseTile("b", "dhcp.pools", "g"), grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 } },
    ]);
    const ids = [...iterateTilesInLayout(items)].map((t) => t.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });

  it("findTileInLayout finds root tile and mapTileInLayout updates it", () => {
    const v2: DashboardLayoutV2 = {
      version: 2,
      items: [
        {
          kind: "tile",
          ...baseTile("root", "dhcp.pools"),
          displayMode: "full",
          grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
        },
      ],
    };
    expect(findTileInLayout(v2.items, "root")?.inGroup).toBeNull();
    const next = mapTileInLayout(v2.items, "root", (t) => ({ ...t, region: "x" }));
    const r = next[0];
    if (r?.kind === "tile") expect(r.region).toBe("x");
    else expect.fail("expected root tile");
  });

  it("findTileInLayout and mapTileInLayout update nested tiles", () => {
    const v2: DashboardLayoutV2 = {
      version: 2,
      items: [
        {
          kind: "group",
          id: "g1",
          showBorder: true,
          children: [baseTile("inner", "perf.ram")],
        },
      ],
    };
    expect(findTileInLayout(v2.items, "inner")?.inGroup?.id).toBe("g1");
    const next = mapTileInLayout(v2.items, "inner", (t) => ({ ...t, region: "z" }));
    const inner = (next[0] as DashboardGroup).children[0];
    expect(inner?.region).toBe("z");
  });

  it("findTileInLayout returns null when the id is missing", () => {
    expect(
      findTileInLayout(
        [
          { kind: "group", id: "g", showBorder: true, children: [baseTile("only", "perf.cpu")] },
        ],
        "nope",
      ),
    ).toBeNull();
  });

  it("mapTileInLayout leaves other root tiles unchanged", () => {
    const a = { kind: "tile" as const, ...baseTile("a", "perf.cpu") };
    const b = { kind: "tile" as const, ...baseTile("b", "perf.ram") };
    const next = mapTileInLayout(
      [a, b],
      "b",
      (t) => ({ ...t, region: "z" }),
    );
    if (next[0]?.kind === "tile") expect(next[0].region).toBeUndefined();
    if (next[1]?.kind === "tile") expect(next[1].region).toBe("z");
  });

  it("mapRootItemsReplaceGroup swaps a group", () => {
    const g: DashboardGroup = {
      kind: "group",
      id: "gx",
      showBorder: true,
      children: [],
    };
    const items = mapRootItemsReplaceGroup([g], "gx", { ...g, showBorder: false });
    expect((items[0] as DashboardGroup).showBorder).toBe(false);
  });

  it("removeTileFromAnywhere drops a root tile and a nested tile", () => {
    const t1 = { kind: "tile" as const, ...baseTile("r1", "dhcp.pools") };
    const t2 = { ...baseTile("in1", "perf.cpu"), grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } };
    const g: DashboardGroup = { kind: "group", id: "g1", showBorder: true, children: [t2] };
    const items: RootLayoutItem[] = [t1, g];
    const a = removeTileFromAnywhere(items, "r1");
    expect(a.length).toBe(1);
    const b = removeTileFromAnywhere(items, "in1");
    expect(b[1]!.kind === "group" && b[1].children.length).toBe(0);
  });

  it("moveTileToParent moves a tile from a group to the root and strips rowPanel", () => {
    const inner = {
      ...baseTile("m1", "perf.ram"),
      rowPanel: "legacy" as const,
      grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
    };
    const g: DashboardGroup = { kind: "group", id: "g1", showBorder: true, children: [inner] };
    const items: RootLayoutItem[] = [g];
    const moved = moveTileToParent(items, "m1", { type: "root" }, inner);
    expect(moved.length).toBe(2);
    const root = moved[1]!;
    expect(root.kind).toBe("tile");
    if (root.kind === "tile") expect((root as { rowPanel?: string }).rowPanel).toBeUndefined();
  });

  it("moveTileToParent moves a root tile into a group", () => {
    const t1: RootLayoutItem = { kind: "tile" as const, ...baseTile("r1", "perf.cpu") };
    const g: DashboardGroup = { kind: "group", id: "g1", showBorder: true, children: [] };
    const items: RootLayoutItem[] = [t1, g];
    const tile = baseTile("r1", "perf.cpu");
    const out = moveTileToParent(items, "r1", { type: "group", groupId: "g1" }, {
      ...tile,
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
    });
    expect(out.some((i) => i.kind === "tile" && i.id === "r1")).toBe(false);
    const gg = out.find((i): i is DashboardGroup => i.kind === "group" && i.id === "g1");
    expect(gg?.children?.some((c) => c.id === "r1")).toBe(true);
  });

  it("moveTileToParent leaves other groups unchanged when reparenting into a group", () => {
    const t: RootLayoutItem = { kind: "tile", ...baseTile("r1", "perf.cpu") };
    const g1: DashboardGroup = { kind: "group", id: "g1", showBorder: true, children: [] };
    const g2: DashboardGroup = { kind: "group", id: "g2", showBorder: true, children: [] };
    const items: RootLayoutItem[] = [t, g1, g2];
    const out = moveTileToParent(items, "r1", { type: "group", groupId: "g2" }, {
      ...baseTile("r1", "perf.cpu"),
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
    });
    const foundG1 = out.find((i): i is DashboardGroup => i.kind === "group" && i.id === "g1");
    const foundG2 = out.find((i): i is DashboardGroup => i.kind === "group" && i.id === "g2");
    expect(foundG1?.children.length).toBe(0);
    expect(foundG2?.children.some((c) => c.id === "r1")).toBe(true);
  });
});
