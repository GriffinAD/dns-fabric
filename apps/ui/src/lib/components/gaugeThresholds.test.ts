import { describe, expect, it } from "vitest";

import { gaugeArcSegmentsForFill } from "./gaugeThresholds";

describe("gaugeThresholds", () => {
  describe("gaugeArcSegmentsForFill", () => {
    it("returns empty for non-positive or invalid", () => {
      expect(gaugeArcSegmentsForFill(0)).toEqual([]);
      expect(gaugeArcSegmentsForFill(-1)).toEqual([]);
      expect(gaugeArcSegmentsForFill(Number.NaN)).toEqual([]);
    });

    it("fills only within the first band at 50%", () => {
      const s = gaugeArcSegmentsForFill(50);
      expect(s).toHaveLength(1);
      expect(s[0]!.t0).toBe(0);
      expect(s[0]!.t1).toBe(0.5);
      expect(s[0]!.className).toContain("emerald");
    });

    it("splits at 70% into green and yellow", () => {
      const s = gaugeArcSegmentsForFill(75);
      expect(s).toHaveLength(2);
      expect(s[0]!.t1).toBe(0.7);
      expect(s[1]!.t0).toBe(0.7);
      expect(s[1]!.t1).toBe(0.75);
      expect(s[1]!.className).toContain("amber");
    });

    it("at 95% produces four coloured segments along the arc", () => {
      const s = gaugeArcSegmentsForFill(95);
      expect(s).toHaveLength(4);
      expect(s[0]!.t0).toBe(0);
      expect(s[0]!.t1).toBe(0.7);
      expect(s[1]!.t0).toBe(0.7);
      expect(s[1]!.t1).toBe(0.8);
      expect(s[2]!.t0).toBe(0.8);
      expect(s[2]!.t1).toBe(0.9);
      expect(s[3]!.t0).toBe(0.9);
      expect(s[3]!.t1).toBe(0.95);
      expect(s[0]!.className).toContain("emerald");
      expect(s[1]!.className).toContain("amber");
      expect(s[2]!.className).toContain("orange");
      expect(s[3]!.className).toContain("rose");
    });

    it("clamps fill to 100%", () => {
      const s = gaugeArcSegmentsForFill(100);
      expect(s).toHaveLength(4);
      expect(s[3]!.t1).toBe(1);
    });
  });
});
