import { describe, expect, it } from "vitest";

import { noWrapReadRowGroups } from "./readModeLayout";
import type { DashboardTile } from "../types";

function tile(id: string, row: number, col: number): DashboardTile {
  return {
    id,
    pluginId: "perf.summary",
    hostControl: "single-panel",
    displayMode: "full",
    grid: { row, col, colSpan: 1, rowSpan: 1 },
  };
}

describe("noWrapReadRowGroups", () => {
  it("returns empty rows for empty input", () => {
    expect(noWrapReadRowGroups([])).toEqual([]);
  });

  it("returns a single sorted row with deduped ids", () => {
    const rows = noWrapReadRowGroups([tile("b", 2, 1), tile("a", 1, 3), tile("b", 2, 1)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("sorts tiles without grid metadata as row 0 col 0", () => {
    const bare: DashboardTile = {
      id: "z",
      pluginId: "perf.summary",
      hostControl: "single-panel",
      displayMode: "full",
    };
    const rows = noWrapReadRowGroups([tile("a", 1, 2), bare]);
    expect(rows[0].map((t) => t.id)).toEqual(["z", "a"]);
  });

  it("orders by column when tiles share the same row", () => {
    const rows = noWrapReadRowGroups([tile("b", 1, 5), tile("a", 1, 2)]);
    expect(rows[0].map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("compares columns when row metadata is missing on one tile", () => {
    const noCol = {
      id: "y",
      pluginId: "perf.summary",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { row: 2, rowSpan: 1, colSpan: 1 },
    } as DashboardTile;
    const rows = noWrapReadRowGroups([tile("x", 2, 4), noCol]);
    expect(rows[0].map((t) => t.id)).toEqual(["y", "x"]);
  });

  it("treats missing grid.col as column zero when rows match", () => {
    const noColField = {
      id: "y",
      pluginId: "perf.summary",
      hostControl: "single-panel",
      displayMode: "full",
      grid: { row: 1, col: undefined, colSpan: 1, rowSpan: 1 },
    } as unknown as DashboardTile;
    const rows = noWrapReadRowGroups([tile("x", 1, 3), noColField]);
    expect(rows[0].map((t) => t.id)).toEqual(["y", "x"]);
  });
});
