import { describe, expect, it } from "vitest";

import { createOverlayActions } from "./overlayActions";
import { PARENT_ID_DASHBOARD } from "./layoutTree";
import type { DashboardGroup, DashboardLayoutV3, DashboardTile } from "./types";

function emptyLayout(): DashboardLayoutV3 {
  return { version: 3, items: [] };
}

describe("createOverlayActions", () => {
  it("closeTileSettings clears tile", () => {
    let tile: DashboardTile | null = {
      id: "t",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
    };
    const o = createOverlayActions({
      getLayout: emptyLayout,
      getEditorOpen: () => false,
      getSettingsTile: () => tile,
      getSettingsGroup: () => null,
      setSettingsTile: (t) => {
        tile = t;
      },
      setSettingsGroup: () => {},
      applyLayoutStructure: () => {},
    });
    o.closeTileSettings();
    expect(tile).toBeNull();
  });

  it("closeGroupSettings clears group", () => {
    let group: DashboardGroup | null = {
      kind: "group",
      id: "g",
      showBorder: true,
      children: [],
    };
    const o = createOverlayActions({
      getLayout: emptyLayout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => group,
      setSettingsTile: () => {},
      setSettingsGroup: (g) => {
        group = g;
      },
      applyLayoutStructure: () => {},
    });
    o.closeGroupSettings();
    expect(group).toBeNull();
  });

  it("openGroupSettings clears tile and sets group", () => {
    let tile: DashboardTile | null = {
      id: "t",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
    };
    let group: DashboardGroup | null = null;
    const g: DashboardGroup = { kind: "group", id: "g", showBorder: true, children: [] };
    const o = createOverlayActions({
      getLayout: emptyLayout,
      getEditorOpen: () => false,
      getSettingsTile: () => tile,
      getSettingsGroup: () => group,
      setSettingsTile: (t) => {
        tile = t;
      },
      setSettingsGroup: (gr) => {
        group = gr;
      },
      applyLayoutStructure: () => {},
    });
    o.openGroupSettings(g);
    expect(tile).toBeNull();
    expect(group).toEqual(g);
  });

  it("saveTileFromOverlay updates in place when tile stays in the same group", () => {
    const tile: DashboardTile = {
      id: "t1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
    };
    let layout: DashboardLayoutV3 = {
      version: 3,
      items: [{ kind: "group", id: "g1", showBorder: true, children: [tile], grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 } }],
    };
    let applied = 0;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => null,
      setSettingsTile: () => {},
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        applied += 1;
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    o.saveTileFromOverlay({ ...tile, displayMode: "compact" }, "g1");
    expect(applied).toBe(1);
    const g = layout.items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind === "group") {
      const child = g.children[0];
      expect(child && "displayMode" in child ? child.displayMode : undefined).toBe("compact");
    }
  });

  it("saveTileFromOverlay updates in place when parent unchanged", () => {
    const tile: DashboardTile = {
      id: "t1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
    };
    let layout: DashboardLayoutV3 = { version: 3, items: [{ kind: "tile", ...tile }] };
    let applied = 0;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => null,
      setSettingsTile: () => {},
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        applied += 1;
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    o.saveTileFromOverlay({ ...tile, displayMode: "compact" }, PARENT_ID_DASHBOARD);
    expect(applied).toBe(1);
    const t = layout.items[0];
    expect(t?.kind === "tile" && t.displayMode).toBe("compact");
  });

  it("saveGroupFromOverlay replaces group and clears settings", () => {
    const g0: DashboardGroup = {
      kind: "group",
      id: "g",
      showBorder: true,
      children: [],
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 1 },
    };
    let layout: DashboardLayoutV3 = { version: 3, items: [g0] };
    let group: DashboardGroup | null = g0;
    let applied = 0;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => group,
      setSettingsTile: () => {},
      setSettingsGroup: (gr) => {
        group = gr;
      },
      applyLayoutStructure: (next) => {
        applied += 1;
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    const nextG: DashboardGroup = { ...g0, showBorder: false };
    o.saveGroupFromOverlay(nextG);
    expect(applied).toBe(1);
    expect(group).toBeNull();
    expect(layout.items[0]?.kind === "group" && layout.items[0].showBorder).toBe(false);
  });

  it("saveGroupFromOverlay replaces a nested group", () => {
    const inner: DashboardGroup = { kind: "group", id: "inner", showBorder: true, children: [] };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [inner],
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 },
    };
    let layout: DashboardLayoutV3 = { version: 3, items: [outer] };
    let group: DashboardGroup | null = inner;
    let applied = 0;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => group,
      setSettingsTile: () => {},
      setSettingsGroup: (gr) => {
        group = gr;
      },
      applyLayoutStructure: (next) => {
        applied += 1;
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    const nextInner: DashboardGroup = { ...inner, showBorder: false };
    o.saveGroupFromOverlay(nextInner);
    expect(applied).toBe(1);
    expect(group).toBeNull();
    const og = layout.items[0];
    expect(og?.kind).toBe("group");
    if (og?.kind === "group") {
      expect(og.children[0]).toMatchObject({ kind: "group", showBorder: false });
    }
  });

  it("deleteLayoutGroupById removes nested group and clears group settings", () => {
    const inner: DashboardGroup = { kind: "group", id: "inner", showBorder: true, children: [] };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [inner],
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 },
    };
    let layout: DashboardLayoutV3 = { version: 3, items: [outer] };
    let group: DashboardGroup | null = inner;
    let applied = 0;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => group,
      setSettingsTile: () => {},
      setSettingsGroup: (gr) => {
        group = gr;
      },
      applyLayoutStructure: (next) => {
        applied += 1;
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    o.deleteLayoutGroupById("inner");
    expect(applied).toBe(1);
    expect(group).toBeNull();
    const og = layout.items[0];
    expect(og?.kind).toBe("group");
    if (og?.kind === "group") expect(og.children.length).toBe(0);
  });

  it("deleteLayoutGroupById clears tile settings when tile was inside removed group", () => {
    const innerTile: DashboardTile = {
      id: "gone",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
    };
    const inner: DashboardGroup = { kind: "group", id: "inner", showBorder: true, children: [innerTile] };
    const outer: DashboardGroup = {
      kind: "group",
      id: "outer",
      showBorder: true,
      children: [inner],
      grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 },
    };
    let layout: DashboardLayoutV3 = { version: 3, items: [outer] };
    let tile: DashboardTile | null = innerTile;
    let applied = 0;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => tile,
      getSettingsGroup: () => null,
      setSettingsTile: (t) => {
        tile = t;
      },
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        applied += 1;
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    o.deleteLayoutGroupById("inner");
    expect(applied).toBe(1);
    expect(tile).toBeNull();
  });

  it("openTileSettings clears group and sets tile", () => {
    let tile: DashboardTile | null = null;
    let group: DashboardGroup | null = {
      kind: "group",
      id: "g1",
      showBorder: true,
      children: [],
    };
    const o = createOverlayActions({
      getLayout: emptyLayout,
      getEditorOpen: () => false,
      getSettingsTile: () => tile,
      getSettingsGroup: () => group,
      setSettingsTile: (t) => {
        tile = t;
      },
      setSettingsGroup: (g) => {
        group = g;
      },
      applyLayoutStructure: () => {},
    });
    const nextTile: DashboardTile = {
      id: "x",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
    };
    o.openTileSettings(nextTile);
    expect(group).toBeNull();
    expect(tile).toEqual(nextTile);
  });

  it("selectDashboardView commits when editor open", () => {
    let editor = true;
    let layout: DashboardLayoutV3 = {
      version: 3,
      items: [
        {
          kind: "group",
          id: "g",
          showBorder: true,
          innerWrap: true,
          children: [
            {
              id: "c1",
              pluginId: "dhcp.pools",
              hostControl: "single-panel",
              displayMode: "full",
              grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
            },
          ],
          grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 },
        },
      ],
    };
    let applied = 0;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => editor,
      getSettingsTile: () => null,
      getSettingsGroup: () => null,
      setSettingsTile: () => {},
      setSettingsGroup: () => {},
      applyLayoutStructure: () => {
        applied += 1;
      },
    });
    o.selectDashboardView();
    expect(applied).toBe(1);
  });

  it("selectDashboardView skips commit when editor closed", () => {
    let applied = 0;
    const o = createOverlayActions({
      getLayout: emptyLayout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => null,
      setSettingsTile: () => {},
      setSettingsGroup: () => {},
      applyLayoutStructure: () => {
        applied += 1;
      },
    });
    o.selectDashboardView();
    expect(applied).toBe(0);
  });

  it("saveTileFromOverlay moves a tile from one group to another", () => {
    const tile: DashboardTile = {
      id: "t1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
    };
    let layout: DashboardLayoutV3 = {
      version: 3,
      items: [
        { kind: "group", id: "g1", showBorder: true, children: [tile], grid: { col: 0, row: 0, colSpan: 6, rowSpan: 2 } },
        { kind: "group", id: "g2", showBorder: true, children: [], grid: { col: 6, row: 0, colSpan: 6, rowSpan: 2 } },
      ],
    };
    let saved: DashboardLayoutV3 | null = null;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => null,
      setSettingsTile: () => {},
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        if (next.version === 2 || next.version === 3) saved = next as DashboardLayoutV3;
      },
    });
    o.saveTileFromOverlay(tile, "g2");
    expect(saved).not.toBeNull();
    const g2 = saved!.items.find((i): i is DashboardGroup => i.kind === "group" && i.id === "g2");
    expect(g2?.children.some((c) => c.id === "t1")).toBe(true);
  });

  it("saveTileFromOverlay moves tile to new parent", () => {
    const tile: DashboardTile = {
      id: "t1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
    };
    let layout: DashboardLayoutV3 = {
      version: 3,
      items: [
        { kind: "group", id: "g", showBorder: true, children: [tile], grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 } },
      ],
    };
    let saved: DashboardLayoutV3 | null = null;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => null,
      setSettingsTile: () => {},
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        if (next.version === 2 || next.version === 3) saved = next as DashboardLayoutV3;
      },
    });
    o.saveTileFromOverlay(tile, PARENT_ID_DASHBOARD);
    expect(saved).not.toBeNull();
    expect(saved!.items.some((it) => it.kind === "tile" && it.id === "t1")).toBe(true);
  });

  it("deleteRootLayoutItem removes root tile and closes tile settings when that tile was open", () => {
    const tile: DashboardTile = {
      id: "t1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
    };
    let layout: DashboardLayoutV3 = { version: 3, items: [{ kind: "tile", ...tile }] };
    let settingsTile: DashboardTile | null = tile;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => settingsTile,
      getSettingsGroup: () => null,
      setSettingsTile: (t) => {
        settingsTile = t;
      },
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    o.deleteRootLayoutItem("t1");
    expect(settingsTile).toBeNull();
    expect(layout.items.length).toBe(0);
  });

  it("deleteGroupChildTile leaves non-matching root items unchanged in the map", () => {
    const root: DashboardTile = {
      id: "rt",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
    };
    const child: DashboardTile = {
      id: "c1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
    };
    let layout: DashboardLayoutV3 = {
      version: 3,
      items: [
        { kind: "tile", ...root },
        { kind: "group", id: "g", showBorder: true, children: [child] },
      ],
    };
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => null,
      setSettingsTile: () => {},
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    o.deleteGroupChildTile("g", "c1");
    expect(layout.items[0]?.kind).toBe("tile");
    expect(layout.items[1]?.kind === "group" && layout.items[1].children.length).toBe(0);
  });

  it("deleteGroupChildTile keeps tile settings when another tile remains in layout", () => {
    const keep: DashboardTile = {
      id: "c2",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
    };
    const remove: DashboardTile = {
      id: "c1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
    };
    let layout: DashboardLayoutV3 = {
      version: 3,
      items: [{ kind: "group", id: "g", showBorder: true, children: [remove, keep] }],
    };
    let settingsTile: DashboardTile | null = keep;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => settingsTile,
      getSettingsGroup: () => null,
      setSettingsTile: (t) => {
        settingsTile = t;
      },
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    o.deleteGroupChildTile("g", "c1");
    expect(settingsTile).toEqual(keep);
  });

  it("deleteRootLayoutItem removes group and closes overlay", () => {
    let layout: DashboardLayoutV3 = {
      version: 3,
      items: [{ kind: "group", id: "g", showBorder: true, children: [] }],
    };
    let group: DashboardGroup | null = layout.items[0] as DashboardGroup;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => group,
      setSettingsTile: () => {},
      setSettingsGroup: (g) => {
        group = g;
      },
      applyLayoutStructure: (next) => {
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    o.deleteRootLayoutItem("g");
    expect(layout.items.length).toBe(0);
    expect(group).toBeNull();
  });

  it("deleteGroupChildTile removes child and closes tile settings if gone", () => {
    const child: DashboardTile = {
      id: "c1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
    };
    let layout: DashboardLayoutV3 = {
      version: 3,
      items: [{ kind: "group", id: "g", showBorder: true, children: [child] }],
    };
    let settingsTile: DashboardTile | null = child;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => settingsTile,
      getSettingsGroup: () => null,
      setSettingsTile: (t) => {
        settingsTile = t;
      },
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        if (next.version === 2 || next.version === 3) layout = next as DashboardLayoutV3;
      },
    });
    o.deleteGroupChildTile("g", "c1");
    expect(settingsTile).toBeNull();
    const g = layout.items[0];
    expect(g?.kind === "group" && g.children.length).toBe(0);
  });
});
