import { describe, expect, it } from "vitest";

import { compareRootItemsByPosition } from "./layoutCompare";
import type { DashboardGroup, RootTileItem } from "./types";

describe("compareRootItemsByPosition", () => {
  it("sorts group without grid like 0,0", () => {
    const g: DashboardGroup = { kind: "group", id: "g", showBorder: true, children: [] };
    const t: RootTileItem = {
      kind: "tile",
      id: "t",
      pluginId: "p",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
    };
    expect(compareRootItemsByPosition(g, t)).toBeLessThan(0);
    expect(compareRootItemsByPosition(t, g)).toBeGreaterThan(0);
  });
});
