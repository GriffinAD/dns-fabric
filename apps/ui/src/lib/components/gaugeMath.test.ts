import { describe, expect, it } from "vitest";

import { describeSemicircleArc, describeSemicircleSegment } from "./gaugeMath";

describe("gaugeMath", () => {
  it("describeSemicircleArc is upper semicircle left to right", () => {
    expect(describeSemicircleArc(50, 50, 40)).toBe("M 10 50 A 40 40 0 0 1 90 50");
  });

  it("full segment 0–1 matches describeSemicircleArc", () => {
    expect(describeSemicircleSegment(50, 50, 40, 0, 1)).toBe(describeSemicircleArc(50, 50, 40));
  });

  it("describeSemicircleSegment is empty when t1 <= t0", () => {
    expect(describeSemicircleSegment(50, 50, 40, 0.5, 0.5)).toBe("");
  });

  it("interior t range uses a single elliptical arc command", () => {
    const d = describeSemicircleSegment(50, 50, 40, 0.2, 0.35);
    expect(d).toMatch(/^M /);
    expect(d).toContain(" A 40 40 0 0 1 ");
  });
});
