import { describe, expect, it } from "vitest";

import { columnSpansOn, columnSpansOn12 } from "./gaugeGridLayout";

describe("columnSpansOn", () => {
  it("clamps trackCount to 1..12 and sums to that count for n in range", () => {
    const s4 = columnSpansOn(8, 4)!;
    expect(s4.length).toBe(4);
    expect(s4.reduce((a, b) => a + b, 0)).toBe(8);
    expect(s4.every((x) => x === 2)).toBe(true);
  });

  it("returns null when n > trackCount (after clamp)", () => {
    expect(columnSpansOn(8, 9)).toBe(null);
  });

  it("returns empty array when n <= 0", () => {
    expect(columnSpansOn(12, 0)).toEqual([]);
    expect(columnSpansOn(12, -3)).toEqual([]);
  });

  it("clamps a large trackCount to 12", () => {
    const s = columnSpansOn(99, 4)!;
    expect(s.reduce((a, b) => a + b, 0)).toBe(12);
  });
});

describe("columnSpansOn12 (alias)", () => {
  it("returns null for n > 12", () => {
    expect(columnSpansOn12(13)).toBe(null);
  });

  it("sums to 12 for n in 1..12", () => {
    for (let n = 1; n <= 12; n++) {
      const s = columnSpansOn12(n)!;
      expect(s.length).toBe(n);
      expect(s.reduce((a, b) => a + b, 0)).toBe(12);
    }
  });
});
