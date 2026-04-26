import { describe, expect, it } from "vitest";

import {
  buildRootLayoutFromDnd,
  dndListItemToDashboardTile,
  finalizeGroupChildrenFromDnd,
  isDndCellGroup,
} from "./groupDndFinalize";
import type { DashboardGroup, DashboardTile, RootLayoutItem } from "./types";

function baseTile(
  id: string,
  grid: { col: number; row: number; colSpan: number; rowSpan: number },
  pluginId = "dhcp.pools",
): DashboardTile {
  return {
    id,
    pluginId,
    hostControl: "single-panel",
    displayMode: "full",
    grid,
  };
}

function baseGroup(
  id: string,
  children: (DashboardTile | DashboardGroup)[],
  opts?: { innerWrap?: boolean; grid?: DashboardGroup["grid"] },
): DashboardGroup {
  return {
    kind: "group",
    id,
    showBorder: true,
    grid: opts?.grid ?? { col: 0, row: 0, colSpan: 20, rowSpan: 4 },
    innerWrap: opts?.innerWrap,
    children,
  };
}

describe("groupDndFinalize", () => {
  it("isDndCellGroup discriminates group vs tile", () => {
    const g = baseGroup("g", []);
    expect(isDndCellGroup(g)).toBe(true);
    expect(isDndCellGroup(baseTile("t", { col: 0, row: 0, colSpan: 1, rowSpan: 1 }))).toBe(false);
  });

  it("dndListItemToDashboardTile returns the tile and strips optional kind", () => {
    const inner = baseTile("t", { col: 0, row: 0, colSpan: 4, rowSpan: 1 });
    const row = { id: inner.id, item: { ...inner, kind: "tile" as const } };
    const out = dndListItemToDashboardTile(row);
    expect(out.id).toBe("t");
    expect((out as unknown as Record<string, unknown>).kind).toBeUndefined();
  });

  it("dndListItemToDashboardTile throws when the row is a group", () => {
    const g = baseGroup("g", []);
    expect(() => dndListItemToDashboardTile({ id: g.id, item: g })).toThrow(/expected a tile/);
  });

  it("finalizeGroupChildrenFromDnd reorders nowrap tiles using slot origins", () => {
    const a = baseTile("a", { col: 0, row: 0, colSpan: 4, rowSpan: 1 });
    const b = baseTile("b", { col: 4, row: 0, colSpan: 4, rowSpan: 1 });
    const prev = baseGroup("g", [a, b], { innerWrap: false });
    const dndList = [
      { id: "b", item: b },
      { id: "a", item: a },
    ];
    const out = finalizeGroupChildrenFromDnd(prev, dndList, {});
    expect(out.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("finalizeGroupChildrenFromDnd packs innerWrap tiles after reorder", () => {
    const a = baseTile("a", { col: 0, row: 0, colSpan: 10, rowSpan: 1 });
    const b = baseTile("b", { col: 0, row: 1, colSpan: 10, rowSpan: 1 });
    const prev = baseGroup(
      "g",
      [a, b],
      { innerWrap: true, grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 } },
    );
    const dndList = [
      { id: "b", item: b },
      { id: "a", item: a },
    ];
    const out = finalizeGroupChildrenFromDnd(prev, dndList, {});
    expect(out.length).toBe(2);
    const ta = out.find((c) => c.id === "a");
    expect(ta && "grid" in ta && ta.grid).toBeDefined();
  });

  it("finalizeGroupChildrenFromDnd recurses into nested groups", () => {
    const innerTile = baseTile("inner-t", { col: 0, row: 0, colSpan: 4, rowSpan: 1 });
    const inner = baseGroup("inner", [innerTile], { innerWrap: false });
    const outer = baseGroup("outer", [inner], { innerWrap: false });
    const dndList = [{ id: "inner", item: inner }];
    const out = finalizeGroupChildrenFromDnd(outer, dndList, {});
    expect(out[0]?.id).toBe("inner");
    if (out[0] && "kind" in out[0] && out[0].kind === "group") {
      expect(out[0].children[0]?.id).toBe("inner-t");
    }
  });

  it("finalizeGroupChildrenFromDnd uses dnd item when previous child is missing", () => {
    const prev = baseGroup("g", [baseTile("a", { col: 0, row: 0, colSpan: 4, rowSpan: 1 })], {
      innerWrap: false,
    });
    const ghost = baseTile("ghost", { col: 4, row: 0, colSpan: 4, rowSpan: 1 });
    const dndList = [
      { id: "a", item: prev.children[0] as DashboardTile },
      { id: "ghost", item: ghost },
    ];
    const out = finalizeGroupChildrenFromDnd(prev, dndList, {});
    expect(out.some((c) => c.id === "ghost")).toBe(true);
  });

  it("buildRootLayoutFromDnd returns group unchanged when layout has no matching id", () => {
    const g = baseGroup("missing-from-layout", [], { innerWrap: false });
    const dndRoot = [{ id: g.id, item: g }];
    const out = buildRootLayoutFromDnd([], dndRoot, {});
    expect(out[0]).toEqual(g);
  });

  it("buildRootLayoutFromDnd merges group children and passes tiles through", () => {
    const t = baseTile("t", { col: 0, row: 0, colSpan: 6, rowSpan: 1 });
    const prevG = baseGroup("g", [t], { innerWrap: false });
    const items: RootLayoutItem[] = [prevG];
    const dndRoot = [{ id: "g", item: prevG }];
    const out = buildRootLayoutFromDnd(items, dndRoot, {});
    expect(out[0]?.kind).toBe("group");
    if (out[0]?.kind === "group") {
      expect(out[0].children.some((c) => c.id === "t")).toBe(true);
    }
  });

  it("buildRootLayoutFromDnd clones a root tile", () => {
    const t: RootLayoutItem = {
      kind: "tile",
      ...baseTile("r", { col: 0, row: 0, colSpan: 4, rowSpan: 1 }),
    };
    const out = buildRootLayoutFromDnd([t], [{ id: "r", item: t }], {});
    expect(out[0]?.kind).toBe("tile");
    if (out[0]?.kind === "tile") {
      expect(out[0].id).toBe("r");
      expect(out[0]).not.toBe(t);
    }
  });
});
