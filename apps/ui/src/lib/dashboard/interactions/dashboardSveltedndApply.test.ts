import type { DragDropState } from "@thisux/sveltednd";
import { describe, expect, it, vi } from "vitest";

import type { DashboardDndListItem } from "../groupDndFinalize";
import type { DashboardGroup, RootLayoutItem } from "../types";

import {
  type DashboardDragPayload,
  groupCellPayload,
  groupChildSlotContainer,
  groupEmptyContainer,
  paletteAddGroupPayload,
  palettePluginPayload,
  parseDragPayload,
  parseDropContainer,
  rootRowEndContainer,
  rootCellPayload,
  rootSlotContainer,
  ROOT_EMPTY_CONTAINER,
} from "./dashboardSveltedndTypes";
import { applyDashboardDrop, applyDashboardInvalidDrop, reorderByTarget } from "./dashboardSveltedndApply";

function layoutTile(id: string): RootLayoutItem {
  return { kind: "tile", id, pluginId: "p", hostControl: "single-panel", displayMode: "full" };
}

function layoutGroup(id: string, children: DashboardGroup["children"] = []): DashboardGroup {
  return {
    kind: "group",
    id,
    showBorder: true,
    children,
    grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 },
  };
}

function childTile(id: string) {
  return { id, pluginId: "p", hostControl: "single-panel" as const, displayMode: "full" as const };
}

function state<T>(partial: Partial<DragDropState<T>>): DragDropState<T> {
  return {
    isDragging: true,
    draggedItem: null as unknown as T,
    sourceContainer: "",
    targetContainer: null,
    targetElement: null,
    dropPosition: null,
    invalidDrop: false,
    ...partial,
  } as DragDropState<T>;
}

function dndTile(id: string): DashboardDndListItem {
  return {
    id,
    item: { kind: "tile" as const, id, pluginId: "p", hostControl: "single-panel", displayMode: "full" },
  };
}

describe("dashboardSveltedndTypes", () => {
  it("parseDropContainer parses root, empty, group child, group empty", () => {
    expect(parseDropContainer("r:tile-1")).toEqual({ kind: "root", id: "tile-1" });
    expect(parseDropContainer("r:end:tile-1")).toEqual({ kind: "rootRowEnd", id: "tile-1" });
    expect(parseDropContainer("r:__empty__")).toEqual({ kind: "rootEmpty" });
    expect(parseDropContainer("g:g1:c:t2")).toEqual({ kind: "groupChild", groupId: "g1", childId: "t2" });
    expect(parseDropContainer("g:g1:empty")).toEqual({ kind: "groupEmpty", groupId: "g1" });
    expect(parseDropContainer(null)).toBe(null);
  });

  it("parseDragPayload round-trips JSON-safe payloads", () => {
    const p = palettePluginPayload("dhcp.clients");
    expect(parseDragPayload(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(parseDragPayload({ k: "cr", i: "x" })).toEqual(rootCellPayload("x"));
    expect(parseDragPayload({ k: "pg" })).toEqual(paletteAddGroupPayload());
    const cg = groupCellPayload("g1", "c1");
    expect(parseDragPayload(JSON.parse(JSON.stringify(cg)))).toEqual(cg);
    expect(groupCellPayload("a", "b")).toEqual({ k: "cg", g: "a", i: "b" });
    expect(parseDragPayload({ bad: true })).toBe(null);
    expect(parseDragPayload(null)).toBe(null);
    expect(parseDragPayload("x")).toBe(null);
  });

  it("container helpers match parseDropContainer", () => {
    expect(parseDropContainer(rootSlotContainer("a"))).toEqual({ kind: "root", id: "a" });
    expect(parseDropContainer(rootRowEndContainer("a"))).toEqual({ kind: "rootRowEnd", id: "a" });
    expect(parseDropContainer(groupChildSlotContainer("g", "c"))).toEqual({
      kind: "groupChild",
      groupId: "g",
      childId: "c",
    });
    expect(parseDropContainer(groupEmptyContainer("g"))).toEqual({ kind: "groupEmpty", groupId: "g" });
    expect(parseDropContainer("r:")).toBe(null);
    expect(parseDropContainer("nope")).toBe(null);
    expect(parseDropContainer("g:x:empty:extra")).toBe(null);
    expect(parseDropContainer("g::empty")).toBe(null);
  });
});

describe("reorderByTarget", () => {
  it("moves item before and after targets", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(reorderByTarget(rows, "c", "a", "before").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(reorderByTarget(rows, "a", "b", "after").map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("no-op when dragging onto self", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(reorderByTarget(rows, "a", "a", "before")).toEqual(rows);
  });

  it("no-op when id missing from list", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(reorderByTarget(rows, "x", "a", "before")).toEqual(rows);
    expect(reorderByTarget(rows, "a", "x", "before")).toEqual(rows);
  });
});

describe("applyDashboardDrop", () => {
  it("calls onAddTile with insert index for palette → root", () => {
    const onAddTile = vi.fn();
    const root = [dndTile("t1"), dndTile("t2")];
    applyDashboardDrop(
      state({
        draggedItem: palettePluginPayload("new.plugin"),
        targetContainer: rootSlotContainer("t2"),
        dropPosition: "before",
      }),
      {
        dndRoot: root,
        dndByGroup: {},
        layoutItems: root.map((d) => d.item as RootLayoutItem),
        onAddTile,
      },
    );
    expect(onAddTile).toHaveBeenCalledWith("new.plugin", 1);
  });

  it("calls onAddTileToGroup for palette → group empty", () => {
    const onAddTileToGroup = vi.fn();
    applyDashboardDrop(
      state({
        draggedItem: palettePluginPayload("p1"),
        targetContainer: groupEmptyContainer("g1"),
        dropPosition: "before",
      }),
      { dndRoot: [], dndByGroup: { g1: [] }, layoutItems: [], onAddTileToGroup },
    );
    expect(onAddTileToGroup).toHaveBeenCalledWith("g1", "p1");
  });

  it("reorders root via onLayoutStructureChange", () => {
    const onLayoutStructureChange = vi.fn();
    const a = dndTile("a");
    const b = dndTile("b");
    const root = [a, b];
    applyDashboardDrop(
      state({
        draggedItem: rootCellPayload("b"),
        targetContainer: rootSlotContainer("a"),
        dropPosition: "before",
      }),
      {
        dndRoot: root,
        dndByGroup: {},
        layoutItems: root.map((d) => d.item as RootLayoutItem),
        onLayoutStructureChange,
      },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();
  });

  it("treats root row-end drops as after-target when dropPosition is null", () => {
    const onLayoutStructureChange = vi.fn();
    const root = [dndTile("a"), dndTile("b"), dndTile("c")];
    applyDashboardDrop(
      state({
        draggedItem: rootCellPayload("a"),
        targetContainer: rootRowEndContainer("c"),
        dropPosition: null,
      }),
      {
        dndRoot: root,
        dndByGroup: {},
        layoutItems: root.map((d) => d.item as RootLayoutItem),
        onLayoutStructureChange,
      },
    );
    const next = onLayoutStructureChange.mock.calls[0]?.[0];
    expect(next?.items?.map((it: { id: string }) => it.id)).toEqual(["b", "c", "a"]);
  });

  it("compacts root layout after row-end whitespace drop", () => {
    const onLayoutStructureChange = vi.fn();
    const a: RootLayoutItem = {
      ...layoutTile("a"),
      grid: { col: 0, row: 0, colSpan: 10, rowSpan: 1 },
    };
    const b: RootLayoutItem = {
      ...layoutTile("b"),
      grid: { col: 10, row: 0, colSpan: 10, rowSpan: 1 },
    };
    const c: RootLayoutItem = {
      ...layoutTile("c"),
      grid: { col: 0, row: 1, colSpan: 20, rowSpan: 1 },
    };
    applyDashboardDrop(
      state({
        draggedItem: rootCellPayload("b"),
        targetContainer: rootRowEndContainer("c"),
        dropPosition: null,
      }),
      {
        dndRoot: [
          { id: "a", item: a },
          { id: "b", item: b },
          { id: "c", item: c },
        ],
        dndByGroup: {},
        layoutItems: [a, b, c],
        onLayoutStructureChange,
      },
    );
    const next = onLayoutStructureChange.mock.calls[0]?.[0];
    expect(next?.items?.map((it: { id: string }) => it.id)).toEqual(["a", "c", "b"]);
    expect(next?.items?.every((it: { grid?: unknown }) => it.grid != null)).toBe(true);
  });

  it("ignores root drag dropped onto its own root slot", () => {
    const onLayoutStructureChange = vi.fn();
    const g = layoutGroup("g1", [childTile("c1")]);
    const result = applyDashboardDrop(
      state({
        draggedItem: rootCellPayload("g1"),
        targetContainer: rootSlotContainer("g1"),
        dropPosition: "before",
      }),
      {
        dndRoot: [{ id: "g1", item: g }],
        dndByGroup: { g1: [{ id: "c1", item: childTile("c1") }] },
        layoutItems: [g],
        onLayoutStructureChange,
      },
    );
    expect(result).toEqual({});
    expect(onLayoutStructureChange).not.toHaveBeenCalled();
  });

  it("returns empty when target container does not parse", () => {
    expect(
      applyDashboardDrop(
        state({ draggedItem: palettePluginPayload("p"), targetContainer: "??" }),
        { dndRoot: [], dndByGroup: {}, layoutItems: [] },
      ),
    ).toEqual({});
  });

  it("palette add-group → root and → group child", () => {
    const onAddGroup = vi.fn();
    applyDashboardDrop(
      state({
        draggedItem: paletteAddGroupPayload(),
        targetContainer: ROOT_EMPTY_CONTAINER,
        dropPosition: "before",
      }),
      { dndRoot: [dndTile("a")], dndByGroup: {}, layoutItems: [layoutTile("a")], onAddGroup },
    );
    expect(onAddGroup).toHaveBeenCalledWith(1);

    const onAddGroupToGroup = vi.fn();
    applyDashboardDrop(
      state({
        draggedItem: paletteAddGroupPayload(),
        targetContainer: groupChildSlotContainer("g1", "c1"),
      }),
      { dndRoot: [], dndByGroup: {}, layoutItems: [], onAddGroupToGroup },
    );
    expect(onAddGroupToGroup).toHaveBeenCalledWith("g1");
  });

  it("palette plugin → group child slot", () => {
    const onAddTileToGroup = vi.fn();
    applyDashboardDrop(
      state({ draggedItem: palettePluginPayload("plug"), targetContainer: groupChildSlotContainer("g1", "t1") }),
      { dndRoot: [], dndByGroup: {}, layoutItems: [], onAddTileToGroup },
    );
    expect(onAddTileToGroup).toHaveBeenCalledWith("g1", "plug");
  });

  it("palette plugin dropped on root group shell adds into group", () => {
    const onAddTile = vi.fn();
    const onAddTileToGroup = vi.fn();
    const g = layoutGroup("g1", [childTile("c1")]);
    applyDashboardDrop(
      state({
        draggedItem: palettePluginPayload("plug"),
        targetContainer: rootSlotContainer("g1"),
      }),
      {
        dndRoot: [{ id: "g1", item: g }],
        dndByGroup: { g1: [{ id: "c1", item: childTile("c1") }] },
        layoutItems: [g],
        onAddTile,
        onAddTileToGroup,
      },
    );
    expect(onAddTile).not.toHaveBeenCalled();
    expect(onAddTileToGroup).toHaveBeenCalledWith("g1", "plug");
  });

  it("palette add-group dropped on root group shell adds nested group", () => {
    const onAddGroup = vi.fn();
    const onAddGroupToGroup = vi.fn();
    const g = layoutGroup("g1", [childTile("c1")]);
    applyDashboardDrop(
      state({
        draggedItem: paletteAddGroupPayload(),
        targetContainer: rootSlotContainer("g1"),
      }),
      {
        dndRoot: [{ id: "g1", item: g }],
        dndByGroup: { g1: [{ id: "c1", item: childTile("c1") }] },
        layoutItems: [g],
        onAddGroup,
        onAddGroupToGroup,
      },
    );
    expect(onAddGroup).not.toHaveBeenCalled();
    expect(onAddGroupToGroup).toHaveBeenCalledWith("g1");
  });

  it("root drag onto rootEmpty with items reorders before first", () => {
    const onLayoutStructureChange = vi.fn();
    const a = dndTile("a");
    const b = dndTile("b");
    applyDashboardDrop(
      state({
        draggedItem: rootCellPayload("b"),
        targetContainer: ROOT_EMPTY_CONTAINER,
        dropPosition: "after",
      }),
      {
        dndRoot: [a, b],
        dndByGroup: {},
        layoutItems: [layoutTile("a"), layoutTile("b")],
        onLayoutStructureChange,
      },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();
  });

  it("palette plugin dropped on rootEmpty with existing rows appends", () => {
    const onAddTile = vi.fn();
    applyDashboardDrop(
      state({
        draggedItem: palettePluginPayload("plug"),
        targetContainer: ROOT_EMPTY_CONTAINER,
      }),
      {
        dndRoot: [dndTile("a"), dndTile("b")],
        dndByGroup: {},
        layoutItems: [layoutTile("a"), layoutTile("b")],
        onAddTile,
      },
    );
    expect(onAddTile).toHaveBeenCalledWith("plug", 2);
  });

  it("root drag onto rootEmpty when already empty is no-op", () => {
    const onLayoutStructureChange = vi.fn();
    applyDashboardDrop(
      state({ draggedItem: rootCellPayload("x"), targetContainer: ROOT_EMPTY_CONTAINER }),
      { dndRoot: [], dndByGroup: {}, layoutItems: [], onLayoutStructureChange },
    );
    expect(onLayoutStructureChange).not.toHaveBeenCalled();
  });

  it("root tile into group empty appends to group list", () => {
    const onLayoutStructureChange = vi.fn();
    const g = layoutGroup("g1", [childTile("c1")]);
    const root = [dndTile("t-root"), { id: "g1", item: g }];
    applyDashboardDrop(
      state({
        draggedItem: rootCellPayload("t-root"),
        targetContainer: groupEmptyContainer("g1"),
        dropPosition: "before",
      }),
      {
        dndRoot: root,
        dndByGroup: { g1: [{ id: "c1", item: childTile("c1") }] },
        layoutItems: [layoutTile("t-root") as RootLayoutItem, g],
        onLayoutStructureChange,
      },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();
  });

  it("root tile into group child uses insertRelativeTo", () => {
    const onLayoutStructureChange = vi.fn();
    const g = layoutGroup("g1", [childTile("c1"), childTile("c2")]);
    const root = [{ id: "g1", item: g }, dndTile("t-root")];
    applyDashboardDrop(
      state({
        draggedItem: rootCellPayload("t-root"),
        targetContainer: groupChildSlotContainer("g1", "c2"),
        dropPosition: "before",
      }),
      {
        dndRoot: root,
        dndByGroup: {
          g1: [
            { id: "c1", item: childTile("c1") },
            { id: "c2", item: childTile("c2") },
          ],
        },
        layoutItems: [g, layoutTile("t-root")],
        onLayoutStructureChange,
      },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();
  });

  it("ignores root group drop onto its own group child slot", () => {
    const onLayoutStructureChange = vi.fn();
    const g = layoutGroup("g1", [childTile("c1"), childTile("c2")]);
    const result = applyDashboardDrop(
      state({
        draggedItem: rootCellPayload("g1"),
        targetContainer: groupChildSlotContainer("g1", "c1"),
        dropPosition: "before",
      }),
      {
        dndRoot: [{ id: "g1", item: g }],
        dndByGroup: {
          g1: [
            { id: "c1", item: childTile("c1") },
            { id: "c2", item: childTile("c2") },
          ],
        },
        layoutItems: [g],
        onLayoutStructureChange,
      },
    );
    expect(result).toEqual({});
    expect(onLayoutStructureChange).not.toHaveBeenCalled();
  });

  it("group child to root and rootEmpty", () => {
    const onLayoutStructureChange = vi.fn();
    const g = layoutGroup("g1", [childTile("c1")]);
    const anchor = dndTile("anchor");
    const root = [anchor, { id: "g1", item: g }];
    applyDashboardDrop(
      state({
        draggedItem: groupCellPayload("g1", "c1"),
        targetContainer: rootSlotContainer("anchor"),
        dropPosition: "before",
      }),
      {
        dndRoot: root,
        dndByGroup: { g1: [{ id: "c1", item: childTile("c1") }] },
        layoutItems: [layoutTile("anchor"), g],
        onLayoutStructureChange,
      },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();

    onLayoutStructureChange.mockClear();
    const g2 = layoutGroup("g2", [childTile("c2")]);
    const root2 = [{ id: "g2", item: g2 }];
    applyDashboardDrop(
      state({ draggedItem: groupCellPayload("g2", "c2"), targetContainer: ROOT_EMPTY_CONTAINER }),
      {
        dndRoot: root2,
        dndByGroup: { g2: [{ id: "c2", item: childTile("c2") }] },
        layoutItems: [g2],
        onLayoutStructureChange,
      },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();
  });

  it("ignores group child drop on source root group shell", () => {
    const onLayoutStructureChange = vi.fn();
    const g1 = layoutGroup("g1", [childTile("c1")]);
    const root = [{ id: "g1", item: g1 }];
    const result = applyDashboardDrop(
      state({
        draggedItem: groupCellPayload("g1", "c1"),
        targetContainer: rootSlotContainer("g1"),
        dropPosition: "before",
      }),
      {
        dndRoot: root,
        dndByGroup: { g1: [{ id: "c1", item: childTile("c1") }] },
        layoutItems: [g1],
        onLayoutStructureChange,
      },
    );
    expect(result).toEqual({});
    expect(onLayoutStructureChange).not.toHaveBeenCalled();
  });

  it("group child reorder within same group and move to empty end of same group", () => {
    const onLayoutStructureChange = vi.fn();
    const g = layoutGroup("g1", [childTile("c1"), childTile("c2")]);
    const root = [{ id: "g1", item: g }];
    const by = {
      g1: [
        { id: "c1", item: childTile("c1") },
        { id: "c2", item: childTile("c2") },
      ],
    };
    applyDashboardDrop(
      state({
        draggedItem: groupCellPayload("g1", "c2"),
        targetContainer: groupChildSlotContainer("g1", "c1"),
        dropPosition: "before",
      }),
      { dndRoot: root, dndByGroup: by, layoutItems: [g], onLayoutStructureChange },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();

    onLayoutStructureChange.mockClear();
    applyDashboardDrop(
      state({
        draggedItem: groupCellPayload("g1", "c1"),
        targetContainer: groupEmptyContainer("g1"),
        dropPosition: "before",
      }),
      { dndRoot: root, dndByGroup: by, layoutItems: [g], onLayoutStructureChange },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();
  });

  it("group child moves across groups including target empty", () => {
    const onLayoutStructureChange = vi.fn();
    const g1 = layoutGroup("g1", [childTile("a")]);
    const g2 = layoutGroup("g2", [childTile("b")]);
    const root = [
      { id: "g1", item: g1 },
      { id: "g2", item: g2 },
    ];
    applyDashboardDrop(
      state({
        draggedItem: groupCellPayload("g1", "a"),
        targetContainer: groupChildSlotContainer("g2", "b"),
        dropPosition: "after",
      }),
      {
        dndRoot: root,
        dndByGroup: {
          g1: [{ id: "a", item: childTile("a") }],
          g2: [{ id: "b", item: childTile("b") }],
        },
        layoutItems: [g1, g2],
        onLayoutStructureChange,
      },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();

    onLayoutStructureChange.mockClear();
    applyDashboardDrop(
      state({
        draggedItem: groupCellPayload("g1", "a"),
        targetContainer: groupEmptyContainer("g2"),
      }),
      {
        dndRoot: root,
        dndByGroup: {
          g1: [{ id: "a", item: childTile("a") }],
          g2: [{ id: "b", item: childTile("b") }],
        },
        layoutItems: [g1, g2],
        onLayoutStructureChange,
      },
    );
    expect(onLayoutStructureChange).toHaveBeenCalled();
  });

  it("returns empty for unrecognized drag payload shape", () => {
    expect(
      applyDashboardDrop(
        state({
          draggedItem: { k: "??" } as unknown as DashboardDragPayload,
          targetContainer: rootSlotContainer("a"),
        }),
        { dndRoot: [dndTile("a")], dndByGroup: {}, layoutItems: [layoutTile("a")] },
      ),
    ).toEqual({});
  });

  it("returns empty when root or group payload references missing ids", () => {
    expect(
      applyDashboardDrop(
        state({
          draggedItem: rootCellPayload("missing"),
          targetContainer: groupEmptyContainer("g1"),
        }),
        { dndRoot: [dndTile("a")], dndByGroup: { g1: [] }, layoutItems: [layoutTile("a")] },
      ),
    ).toEqual({});

    expect(
      applyDashboardDrop(
        state({
          draggedItem: groupCellPayload("g1", "missing"),
          targetContainer: rootSlotContainer("a"),
        }),
        {
          dndRoot: [dndTile("a")],
          dndByGroup: { g1: [{ id: "c", item: childTile("c") }] },
          layoutItems: [layoutTile("a"), layoutGroup("g1", [childTile("c")])],
        },
      ),
    ).toEqual({});
  });
});

describe("applyDashboardInvalidDrop", () => {
  it("flags inner group strip when dragging that root group", () => {
    const groupItem: DashboardDndListItem = {
      id: "g1",
      item: { kind: "group", id: "g1", showBorder: true, children: [] },
    };
    const st = state({
      draggedItem: rootCellPayload("g1"),
      targetContainer: groupChildSlotContainer("g1", "t1"),
    });
    applyDashboardInvalidDrop(st, [groupItem]);
    expect(st.invalidDrop).toBe(true);
  });

  it("does not flag for palette plugin", () => {
    const st = state({
      draggedItem: palettePluginPayload("p"),
      targetContainer: groupChildSlotContainer("g1", "t1"),
    });
    applyDashboardInvalidDrop(st, []);
    expect(st.invalidDrop).toBe(false);
  });

  it("does not flag for root tile drag or missing target", () => {
    const st = state({ draggedItem: rootCellPayload("t1"), targetContainer: null });
    applyDashboardInvalidDrop(st, [dndTile("t1")]);
    expect(st.invalidDrop).toBe(false);

    const st2 = state({ draggedItem: rootCellPayload("g1"), targetContainer: null });
    applyDashboardInvalidDrop(st2, [
      { id: "g1", item: { kind: "group", id: "g1", showBorder: true, children: [] } },
    ]);
    expect(st2.invalidDrop).toBe(false);
  });

  it("marks root-empty fallback invalid when actually over a tile row", () => {
    const el = document.createElement("div");
    const row = document.createElement("div");
    row.setAttribute("data-dashboard-editor", "tile-row");
    row.appendChild(el);
    const st = state({
      draggedItem: palettePluginPayload("p"),
      targetContainer: ROOT_EMPTY_CONTAINER,
      targetElement: el,
    });
    applyDashboardInvalidDrop(st, []);
    expect(st.invalidDrop).toBe(true);
  });
});
