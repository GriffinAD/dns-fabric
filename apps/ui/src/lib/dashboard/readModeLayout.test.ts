import { describe, expect, it } from "vitest";

import { noWrapReadRowGroups } from "./readModeLayout";
import type { DashboardTile } from "./types";

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
});
