import { describe, expect, it } from "vitest";

import { createAppDashboardShell } from "./appDashboardShell";
import { DataGateway } from "../gateway/dataGateway";
import type { DashboardGroup, DashboardTile } from "../dashboard/types";

const minimalTile: DashboardTile = {
  id: "t1",
  pluginId: "perf.cpu",
  hostControl: "single-panel",
  displayMode: "full",
  region: "primary-grid",
  grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
};

describe("createAppDashboardShell", () => {
  it("returns layout store and overlay wired to settings binding", () => {
    const gateway = new DataGateway("");
    let tile: DashboardTile | null = null;
    let group: DashboardGroup | null = null;
    const { ls, overlay } = createAppDashboardShell(gateway, {
      getTile: () => tile,
      setTile: (t) => {
        tile = t;
      },
      getGroup: () => group,
      setGroup: (g) => {
        group = g;
      },
    });

    expect(ls.applyStructure).toBeTypeOf("function");
    overlay.openTileSettings(minimalTile);
    expect(tile).toEqual(minimalTile);
    overlay.closeTileSettings();
    expect(tile).toBeNull();
  });
});
