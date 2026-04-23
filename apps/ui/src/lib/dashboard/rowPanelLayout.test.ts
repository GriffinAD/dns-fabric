import { describe, expect, it } from "vitest";

import {
  buildReadOnlyRowPanelUnits,
  rowPanelGridColumnRange1Based,
  rowPanelGridRowRange1Based,
} from "./rowPanelLayout";
import type { DashboardTile } from "./types";

const base = (): Omit<DashboardTile, "id" | "pluginId" | "grid"> & { id: string; pluginId: string; grid: NonNullable<DashboardTile["grid"]> } => ({
  id: "a",
  pluginId: "p",
  hostControl: "single-panel",
  displayMode: "full",
  grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
});

describe("rowPanelLayout", () => {
  it("rowPanelGridRowRange1Based unions tile rows and rowSpans", () => {
    const t1: DashboardTile = { ...base(), id: "1", rowPanel: "g", grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } };
    const t2: DashboardTile = { ...base(), id: "2", rowPanel: "g", grid: { col: 4, row: 0, colSpan: 4, rowSpan: 1 } };
    const t3: DashboardTile = { ...base(), id: "3", rowPanel: "g", grid: { col: 0, row: 1, colSpan: 12, rowSpan: 1 } };
    expect(rowPanelGridRowRange1Based([t1, t2])).toEqual({ start1: 1, span: 1 });
    expect(rowPanelGridRowRange1Based([t1, t2, t3])).toEqual({ start1: 1, span: 2 });
  });

  it("rowPanelGridColumnRange1Based is full width when no other tile shares a row with the group", () => {
    const gTiles: DashboardTile[] = [
      { ...base(), id: "a", rowPanel: "g", grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } },
      { ...base(), id: "b", rowPanel: "g", grid: { col: 4, row: 0, colSpan: 2, rowSpan: 1 } },
    ];
    const all: DashboardTile[] = [...gTiles];
    const r = rowPanelGridColumnRange1Based(gTiles, all);
    expect(r).toEqual({ colStart1: 1, colSpan: 12, fullWidth: true });
  });

  it("rowPanelGridColumnRange1Based is tight when another tile is on the same row", () => {
    const gTiles: DashboardTile[] = [
      { ...base(), id: "a", rowPanel: "g", grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } },
      { ...base(), id: "b", rowPanel: "g", grid: { col: 4, row: 0, colSpan: 2, rowSpan: 1 } },
    ];
    const other: DashboardTile = { ...base(), id: "x", grid: { col: 8, row: 0, colSpan: 2, rowSpan: 1 } };
    const r = rowPanelGridColumnRange1Based(gTiles, [...gTiles, other]);
    expect(r.fullWidth).toBe(false);
    expect(r).toEqual({ colStart1: 1, colSpan: 6, fullWidth: false });
  });

  it("buildReadOnlyRowPanelUnits groups by rowPanel and sorts", () => {
    const tA: DashboardTile = { ...base(), id: "a", rowPanel: "g", grid: { col: 0, row: 1, colSpan: 1, rowSpan: 1 } };
    const tB: DashboardTile = { ...base(), id: "b", rowPanel: "g", grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 } };
    const tC: DashboardTile = { ...base(), id: "c", grid: { col: 6, row: 0, colSpan: 6, rowSpan: 1 } };
    const u = buildReadOnlyRowPanelUnits([tA, tB, tC]);
    expect(u).toHaveLength(2);
    expect(u[0]).toMatchObject({ kind: "panel", id: "g" });
    expect(u[1]?.kind).toBe("tile");
    if (u[1]?.kind === "tile") expect(u[1].tile.id).toBe("c");
  });
});
