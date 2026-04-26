import { describe, expect, it } from "vitest";

import {
  collectAllGroupsInLayout,
  migrateV1ToV2,
  ensureLayoutV2,
  dedupeLayoutV2ItemIds,
  iterateTilesInLayout,
  findTileInLayout,
  findGroupByIdInItems,
  mapTileInLayout,
  mapLayoutReplaceGroupById,
  mapRootItemsReplaceGroup,
  moveTileToParent,
  removeLayoutGroupById,
  removeTileFromAnywhere,
  dedupeById,
  appendGroupToGroupInItems,
  appendTileToGroupInItems,
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
  it("collectAllGroupsInLayout returns root and nested groups in depth-first order", () => {
    const gOuter: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [
        { kind: "group", id: "inner", showBorder: true, children: [] },
        baseTile("t1", "dhcp.pools"),
      ],
    };
    expect(collectAllGroupsInLayout([gOuter]).map((g) => g.id)).toEqual(["outer", "inner"]);
  });

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
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
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

  it("migrateV1ToV2 skips rowPanel buckets with no child grids", () => {
    const tiles: DashboardTile[] = [
      { ...baseTile("a", "perf.cpu", "solo") },
      { ...baseTile("b", "perf.ram", "solo") },
    ];
    expect(migrateV1ToV2(tiles)).toEqual([]);
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

  it("iterateTilesInLayout walks tiles inside nested groups", () => {
    const inner: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      children: [baseTile("deep", "perf.cpu")],
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [inner],
    };
    const ids = [...iterateTilesInLayout([outer])].map((t) => t.id);
    expect(ids).toEqual(["deep"]);
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

  it("findTileInLayout finds a tile nested two groups deep", () => {
    const deep = { ...baseTile("deep", "perf.cpu"), grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 } };
    const inner: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      children: [deep],
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [inner],
    };
    const hit = findTileInLayout([outer], "deep");
    expect(hit?.tile.id).toBe("deep");
    expect(hit?.inGroup?.id).toBe("inner");
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

  it("mapTileInLayout recurses through nested groups to update a deep tile", () => {
    const deep = { ...baseTile("deep", "perf.cpu"), grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 } };
    const inner: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      children: [deep],
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [inner],
    };
    const next = mapTileInLayout([outer], "deep", (t) => ({ ...t, region: "z" }));
    const o = next[0] as DashboardGroup;
    const i = o.children[0] as DashboardGroup;
    const t = i.children[0] as DashboardTile;
    expect(t.region).toBe("z");
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

  it("mapTileInLayout updates only the matching child when a group has multiple children", () => {
    const c1 = { ...baseTile("c1", "perf.cpu"), grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 } };
    const c2 = { ...baseTile("c2", "perf.ram"), grid: { col: 2, row: 0, colSpan: 2, rowSpan: 1 } };
    const g: DashboardGroup = { kind: "group", id: "g", showBorder: true, children: [c1, c2] };
    const next = mapTileInLayout([g], "c1", (t) => ({ ...t, region: "hit" }));
    const ch = (next[0] as DashboardGroup).children;
    expect(ch[0]?.region).toBe("hit");
    expect(ch[1]?.region).toBeUndefined();
  });

  it("mapRootItemsReplaceGroup leaves non-matching items as-is", () => {
    const t: RootLayoutItem = { kind: "tile", ...baseTile("t", "dhcp.pools") };
    const g: DashboardGroup = { kind: "group", id: "g", showBorder: true, children: [] };
    const nextG: DashboardGroup = { ...g, showBorder: false };
    const out = mapRootItemsReplaceGroup([t, g], "g", nextG);
    expect(out[0]).toBe(t);
    expect((out[1] as DashboardGroup).showBorder).toBe(false);
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

  it("mapLayoutReplaceGroupById updates a nested group", () => {
    const inner: DashboardGroup = { kind: "group", id: "inner", showBorder: true, children: [] };
    const outer: DashboardGroup = { kind: "group", id: "outer", showBorder: true, children: [inner] };
    const nextInner: DashboardGroup = { ...inner, showBorder: false };
    const out = mapLayoutReplaceGroupById([outer], "inner", nextInner);
    const o = out[0] as DashboardGroup;
    const i = o.children[0] as DashboardGroup;
    expect(i.showBorder).toBe(false);
  });

  it("mapLayoutReplaceGroupById leaves root tiles unchanged and recurses past tile siblings", () => {
    const rt: RootLayoutItem = { kind: "tile", ...baseTile("root-t", "dhcp.pools") };
    const deep: DashboardGroup = { kind: "group", id: "deep", showBorder: true, children: [] };
    const mid: DashboardGroup = { kind: "group", id: "mid", showBorder: true, children: [deep] };
    const side: DashboardTile = { ...baseTile("side", "perf.cpu"), displayMode: "full" };
    const root: DashboardGroup = { kind: "group", id: "root", showBorder: true, children: [side, mid] };
    const nextDeep: DashboardGroup = { ...deep, showBorder: false };
    const out = mapLayoutReplaceGroupById([rt, root], "deep", nextDeep);
    expect(out[0]).toBe(rt);
    const r = out[1] as DashboardGroup;
    expect((r.children[0] as DashboardTile).id).toBe("side");
    const m = r.children[1] as DashboardGroup;
    expect((m.children[0] as DashboardGroup).showBorder).toBe(false);
  });

  it("removeLayoutGroupById removes a root group", () => {
    const g: DashboardGroup = { kind: "group", id: "g", showBorder: true, children: [] };
    const t: RootLayoutItem = { kind: "tile", ...baseTile("t", "dhcp.pools") };
    expect(removeLayoutGroupById([t, g], "g")).toEqual([t]);
  });

  it("removeLayoutGroupById removes a nested group and keeps siblings", () => {
    const inner: DashboardGroup = { kind: "group", id: "inner", showBorder: true, children: [] };
    const side: DashboardTile = { ...baseTile("side", "perf.cpu"), displayMode: "full" };
    const outer: DashboardGroup = { kind: "group", id: "outer", showBorder: true, children: [inner, side] };
    const out = removeLayoutGroupById([outer], "inner");
    const o = out[0] as DashboardGroup;
    expect(o.children.length).toBe(1);
    expect(o.children[0]?.id).toBe("side");
  });

  it("removeLayoutGroupById prunes a deep nested group and keeps ancestor chain", () => {
    const leaf: DashboardGroup = { kind: "group", id: "leaf", showBorder: true, children: [] };
    const mid: DashboardGroup = { kind: "group", id: "mid", showBorder: true, children: [leaf] };
    const outer: DashboardGroup = { kind: "group", id: "outer", showBorder: true, children: [mid] };
    const out = removeLayoutGroupById([outer], "leaf");
    const o = out[0] as DashboardGroup;
    const m = o.children[0] as DashboardGroup;
    expect(m.children.length).toBe(0);
  });

  it("removeTileFromAnywhere recurses into nested groups", () => {
    const innerTile = { ...baseTile("x", "perf.cpu"), grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 } };
    const inner: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      children: [innerTile, { ...baseTile("y", "perf.ram"), grid: { col: 2, row: 0, colSpan: 2, rowSpan: 1 } }],
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [inner],
    };
    const out = removeTileFromAnywhere([outer], "x");
    const o = out[0] as DashboardGroup;
    const i = o.children[0] as DashboardGroup;
    expect(i.children.length).toBe(1);
    expect(i.children[0]?.id).toBe("y");
  });

  it("appendTileToGroupInItems preserves sibling tiles while targeting a nested group", () => {
    const target: DashboardGroup = {
      kind: "group",
      id: "target",
      showBorder: true,
      children: [],
    };
    const sideTile = {
      ...baseTile("side", "perf.network"),
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
    };
    const wrapper: DashboardGroup = {
      kind: "group",
      id: "wrap",
      showBorder: true,
      children: [sideTile, target],
    };
    const tile = {
      ...baseTile("in", "dhcp.pools"),
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
    };
    const out = appendTileToGroupInItems([wrapper], "target", tile);
    const w = out[0] as DashboardGroup;
    expect(w.children[0]?.id).toBe("side");
    const tg = w.children[1] as DashboardGroup;
    expect(tg.children.some((c) => c.id === "in")).toBe(true);
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

  it("findGroupByIdInItems finds a nested group", () => {
    const inner: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      children: [baseTile("leaf", "perf.cpu")],
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [inner],
    };
    const items: RootLayoutItem[] = [outer];
    expect(findGroupByIdInItems(items, "inner")?.id).toBe("inner");
    expect(findGroupByIdInItems(items, "outer")?.id).toBe("outer");
    expect(findGroupByIdInItems(items, "missing")).toBeNull();
  });

  it("appendTileToGroupInItems walks a prior root group before the target", () => {
    const target: DashboardGroup = {
      kind: "group",
      id: "target",
      showBorder: true,
      children: [],
    };
    const wrapper: DashboardGroup = {
      kind: "group",
      id: "wrapper",
      showBorder: true,
      children: [target],
    };
    const other: DashboardGroup = {
      kind: "group",
      id: "other",
      showBorder: true,
      children: [],
    };
    const tile = {
      ...baseTile("x", "dhcp.pools"),
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
    };
    const out = appendTileToGroupInItems([other, wrapper], "target", tile);
    const w = out[1] as DashboardGroup;
    expect(w.children[0]?.id).toBe("target");
    const inner = w.children[0] as DashboardGroup;
    expect(inner.children.some((c) => c.id === "x")).toBe(true);
  });

  it("appendTileToGroupInItems leaves root tiles unchanged when appending to a group", () => {
    const target: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      children: [],
    };
    const rootTile: RootLayoutItem = {
      kind: "tile",
      ...baseTile("solo", "perf.cpu"),
    };
    const tile = {
      ...baseTile("in", "dhcp.pools"),
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
    };
    const out = appendTileToGroupInItems([rootTile, target], "g", tile);
    expect(out[0]).toEqual(rootTile);
    expect((out[1] as DashboardGroup).children.length).toBe(1);
  });

  it("appendTileToGroupInItems recurses until it finds the target group id", () => {
    const target: DashboardGroup = {
      kind: "group",
      id: "target",
      showBorder: true,
      children: [],
    };
    const mid: DashboardGroup = {
      kind: "group",
      id: "mid",
      showBorder: true,
      children: [target],
    };
    const root: DashboardGroup = {
      kind: "group",
      id: "root",
      showBorder: true,
      children: [mid],
    };
    const tile = {
      ...baseTile("deep", "dhcp.pools"),
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
    };
    const out = appendTileToGroupInItems([root], "target", tile);
    const r = out[0] as DashboardGroup;
    const m = r.children[0] as DashboardGroup;
    const t = m.children[0] as DashboardGroup;
    expect(t.children.some((c) => c.id === "deep")).toBe(true);
  });

  it("appendTileToGroupInItems appends into a nested group", () => {
    const inner: DashboardGroup = {
      kind: "group",
      id: "inner",
      showBorder: true,
      children: [],
    };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [inner],
    };
    const tile = {
      ...baseTile("new", "dhcp.clients"),
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
    };
    const out = appendTileToGroupInItems([outer], "inner", tile);
    const o = out[0] as DashboardGroup;
    const i = o.children[0] as DashboardGroup;
    expect(i.children.some((c) => c.id === "new")).toBe(true);
  });

  it("appendGroupToGroupInItems appends a nested container", () => {
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [],
    };
    const nested: DashboardGroup = { kind: "group", id: "nested", showBorder: true, children: [] };
    const out = appendGroupToGroupInItems([outer], "outer", nested);
    const o = out[0] as DashboardGroup;
    expect(o.children.length).toBe(1);
    expect(o.children[0]).toMatchObject({ kind: "group", id: "nested" });
  });

  it("appendGroupToGroupInItems finds parent below root", () => {
    const inner: DashboardGroup = { kind: "group", id: "inner", showBorder: true, children: [] };
    const outer: DashboardGroup = { kind: "group", id: "outer", showBorder: true, children: [inner] };
    const nest: DashboardGroup = { kind: "group", id: "nest", showBorder: true, children: [] };
    const out = appendGroupToGroupInItems([outer], "inner", nest);
    const o = out[0] as DashboardGroup;
    const i = o.children[0] as DashboardGroup;
    expect(i.children[0]).toMatchObject({ kind: "group", id: "nest" });
  });

  it("appendGroupToGroupInItems leaves root tiles unchanged when parent id is absent", () => {
    const tile: RootLayoutItem = {
      kind: "tile",
      id: "t1",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "full",
    };
    const nest: DashboardGroup = { kind: "group", id: "nest", showBorder: true, children: [] };
    expect(appendGroupToGroupInItems([tile], "missing", nest)).toEqual([tile]);
  });

  it("appendGroupToGroupInItems preserves tile siblings while recursing to a nested group", () => {
    const inner: DashboardGroup = { kind: "group", id: "inner", showBorder: true, children: [] };
    const siblingTile: DashboardTile = { ...baseTile("t0", "perf.cpu"), displayMode: "full" };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [siblingTile, inner],
    };
    const nest: DashboardGroup = { kind: "group", id: "nest", showBorder: true, children: [] };
    const out = appendGroupToGroupInItems([outer], "inner", nest);
    const o = out[0] as DashboardGroup;
    expect(o.children[0]).toEqual(siblingTile);
    const i = o.children[1] as DashboardGroup;
    expect(i.children[0]).toMatchObject({ kind: "group", id: "nest" });
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
