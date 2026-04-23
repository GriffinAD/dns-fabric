import { describe, expect, it } from "vitest";

import { createOverlayActions } from "./overlayActions";
import { PARENT_ID_DASHBOARD } from "./layoutTree";
import type { DashboardGroup, DashboardLayoutV2, DashboardTile } from "./types";

function emptyLayout(): DashboardLayoutV2 {
  return { version: 2, items: [] };
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

  it("saveTileFromOverlay updates in place when parent unchanged", () => {
    const tile: DashboardTile = {
      id: "t1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
    };
    let layout: DashboardLayoutV2 = { version: 2, items: [{ kind: "tile", ...tile }] };
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
        if (next.version === 2) layout = next;
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
      grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
    };
    let layout: DashboardLayoutV2 = { version: 2, items: [g0] };
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
        if (next.version === 2) layout = next;
      },
    });
    const nextG: DashboardGroup = { ...g0, showBorder: false };
    o.saveGroupFromOverlay(nextG);
    expect(applied).toBe(1);
    expect(group).toBeNull();
    expect(layout.items[0]?.kind === "group" && layout.items[0].showBorder).toBe(false);
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
    let layout: DashboardLayoutV2 = {
      version: 2,
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
          grid: { col: 0, row: 0, colSpan: 12, rowSpan: 2 },
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

  it("saveTileFromOverlay moves tile to new parent", () => {
    const tile: DashboardTile = {
      id: "t1",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
    };
    let layout: DashboardLayoutV2 = {
      version: 2,
      items: [
        { kind: "group", id: "g", showBorder: true, children: [tile], grid: { col: 0, row: 0, colSpan: 12, rowSpan: 2 } },
      ],
    };
    let saved: DashboardLayoutV2 | null = null;
    const o = createOverlayActions({
      getLayout: () => layout,
      getEditorOpen: () => false,
      getSettingsTile: () => null,
      getSettingsGroup: () => null,
      setSettingsTile: () => {},
      setSettingsGroup: () => {},
      applyLayoutStructure: (next) => {
        if (next.version === 2) saved = next;
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
    let layout: DashboardLayoutV2 = { version: 2, items: [{ kind: "tile", ...tile }] };
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
        if (next.version === 2) layout = next;
      },
    });
    o.deleteRootLayoutItem("t1");
    expect(settingsTile).toBeNull();
    expect(layout.items.length).toBe(0);
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
    let layout: DashboardLayoutV2 = {
      version: 2,
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
        if (next.version === 2) layout = next;
      },
    });
    o.deleteGroupChildTile("g", "c1");
    expect(settingsTile).toEqual(keep);
  });

  it("deleteRootLayoutItem removes group and closes overlay", () => {
    let layout: DashboardLayoutV2 = {
      version: 2,
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
        if (next.version === 2) layout = next;
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
    let layout: DashboardLayoutV2 = {
      version: 2,
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
        if (next.version === 2) layout = next;
      },
    });
    o.deleteGroupChildTile("g", "c1");
    expect(settingsTile).toBeNull();
    const g = layout.items[0];
    expect(g?.kind === "group" && g.children.length).toBe(0);
  });
});
