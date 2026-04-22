import { describe, expect, it } from "vitest";

import { describeSemicircleArc, describeSemicircleProgress, polarToCartesian } from "./gaugeMath";

describe("gaugeMath", () => {
  it("polarToCartesian maps 0° to top center", () => {
    const p = polarToCartesian(50, 50, 40, 0);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(10);
  });

  it("describeSemicircleArc produces a path", () => {
    const d = describeSemicircleArc(50, 50, 40);
    expect(d).toMatch(/^M /);
    expect(d).toContain("A");
  });

  it("describeSemicircleProgress clamps percent", () => {
    const low = describeSemicircleProgress(50, 50, 40, -5);
    const high = describeSemicircleProgress(50, 50, 40, 150);
    expect(low).toBeTruthy();
    expect(high).toBeTruthy();
    expect(low).not.toEqual(high);
  });
});
