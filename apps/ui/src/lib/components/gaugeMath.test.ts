import { describe, expect, it } from "vitest";

import {
  describeSemicircleArc,
  describeSemicircleSegment,
  gaugeRadialThroughStroke,
  GAUGE_ARC_SWEEP_RAD,
  semicirclePoint,
} from "./gaugeMath";

describe("gaugeMath", () => {
  it("describeSemicircleArc is 240° arc left to right through the top", () => {
    const d = describeSemicircleArc(50, 50, 40);
    expect(d).toMatch(/^M [\d.]+ [\d.]+ A 40 40 0 1 1 [\d.]+ [\d.]+$/);
  });

  it("endpoints share the same y (horizontal chord)", () => {
    const p0 = semicirclePoint(50, 50, 40, 0);
    const p1 = semicirclePoint(50, 50, 40, 1);
    expect(p0.y).toBeCloseTo(p1.y);
    expect(p0.x).toBeLessThan(50);
    expect(p1.x).toBeGreaterThan(50);
  });

  it("mid-arc is at the top of the circle", () => {
    const pm = semicirclePoint(50, 50, 40, 0.5);
    expect(pm.x).toBeCloseTo(50);
    expect(pm.y).toBeCloseTo(10);
  });

  it("full segment 0–1 matches describeSemicircleArc", () => {
    expect(describeSemicircleSegment(50, 50, 40, 0, 1)).toBe(describeSemicircleArc(50, 50, 40));
  });

  it("describeSemicircleSegment is empty when t1 <= t0", () => {
    expect(describeSemicircleSegment(50, 50, 40, 0.5, 0.5)).toBe("");
  });

  it("short sub-arc uses small arc flag", () => {
    const d = describeSemicircleSegment(50, 50, 40, 0.2, 0.35);
    expect(d).toMatch(/^M /);
    expect(d).toContain(" A 40 40 0 0 1 ");
    const span = (0.35 - 0.2) * GAUGE_ARC_SWEEP_RAD;
    expect(span).toBeLessThan(Math.PI);
  });

  it("gaugeRadialThroughStroke spans stroke thickness from center", () => {
    const { x1, y1, x2, y2 } = gaugeRadialThroughStroke(50, 50, 40, 8, 0.5);
    const d1 = Math.hypot(x1 - 50, y1 - 50);
    const d2 = Math.hypot(x2 - 50, y2 - 50);
    expect(d1).toBeCloseTo(36);
    expect(d2).toBeCloseTo(44);
  });

});
