import { describe, expect, it } from "vitest";

import { GRID_COLUMNS } from "./gridPlacement";
import { columnSpansOn, columnSpansOn12 } from "./gaugeGridLayout";

describe("columnSpansOn", () => {
  it("clamps trackCount to 1..GRID_COLUMNS and sums to that count for n in range", () => {
    const s4 = columnSpansOn(8, 4)!;
    expect(s4.length).toBe(4);
    expect(s4.reduce((a, b) => a + b, 0)).toBe(8);
    expect(s4.every((x) => x === 2)).toBe(true);
  });

  it("returns null when n > trackCount (after clamp)", () => {
    expect(columnSpansOn(8, 9)).toBe(null);
  });

  it("returns empty array when n <= 0", () => {
    expect(columnSpansOn(GRID_COLUMNS, 0)).toEqual([]);
    expect(columnSpansOn(GRID_COLUMNS, -3)).toEqual([]);
  });

  it("clamps a large trackCount to GRID_COLUMNS", () => {
    const s = columnSpansOn(99, 4)!;
    expect(s.reduce((a, b) => a + b, 0)).toBe(GRID_COLUMNS);
  });
});

describe("columnSpansOn12 (alias)", () => {
  it("returns null for n > GRID_COLUMNS", () => {
    expect(columnSpansOn12(GRID_COLUMNS + 1)).toBe(null);
  });

  it("sums to GRID_COLUMNS for n in 1..GRID_COLUMNS", () => {
    for (let n = 1; n <= GRID_COLUMNS; n++) {
      const s = columnSpansOn12(n)!;
      expect(s.length).toBe(n);
      expect(s.reduce((a, b) => a + b, 0)).toBe(GRID_COLUMNS);
    }
  });
});
