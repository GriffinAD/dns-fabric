import { describe, expect, it } from "vitest";

import {
  GAUGE_ARC_ZONE_STOPS,
  clampGaugeArcT,
  gaugeArcSegmentsForFill,
  gaugeBandedStrokeClassAtArcT,
  gaugeFillHexAtArcT,
  gaugeFillHexAtArcU,
} from "./gaugeThresholds";

describe("gaugeThresholds", () => {
  describe("clampGaugeArcT", () => {
    it("passes through arc fractions and clamps outside the gauge domain", () => {
      expect(clampGaugeArcT(0)).toBe(0);
      expect(clampGaugeArcT(0.5)).toBe(0.5);
      expect(clampGaugeArcT(1)).toBe(1);
      expect(clampGaugeArcT(-0.1)).toBe(0);
      expect(clampGaugeArcT(1.1)).toBe(1);
    });

    it("is monotone increasing", () => {
      let prev = -1;
      for (let i = 0; i <= 20; i++) {
        const u = clampGaugeArcT(i / 20);
        expect(u).toBeGreaterThanOrEqual(prev);
        prev = u;
      }
    });
  });

  describe("GAUGE_ARC_ZONE_STOPS", () => {
    it("matches ZONES 70% / 80% / 90% arc (same as banded)", () => {
      expect(GAUGE_ARC_ZONE_STOPS).toEqual({ u70: 0.7, u80: 0.8, u90: 0.9 });
    });
  });

  describe("gaugeFillHexAtArcU", () => {
    it("matches zone colours at ends (light)", () => {
      expect(gaugeFillHexAtArcU(0, false)).toBe("#059669");
      expect(gaugeFillHexAtArcU(1, false)).toBe("#e11d48");
    });

    it("matches zone colours at ends (dark)", () => {
      expect(gaugeFillHexAtArcU(0, true)).toBe("#34d399");
      expect(gaugeFillHexAtArcU(1, true)).toBe("#e11d48");
    });

    it("lerps between zone boundaries", () => {
      const { u70, u80, u90 } = GAUGE_ARC_ZONE_STOPS;
      const emAm = gaugeFillHexAtArcU((u70 + u80) / 2, false);
      expect(emAm).toMatch(/^#[0-9a-f]{6}$/);
      expect(emAm).not.toBe("#059669");
      expect(emAm).not.toBe("#f59e0b");

      const amOr = gaugeFillHexAtArcU((u80 + u90) / 2, false);
      expect(amOr).toBe("#f97316");

      const orRo = gaugeFillHexAtArcU((u80 + u90 * 3) / 4, false);
      expect(orRo).toMatch(/^#[0-9a-f]{6}$/);
      expect(orRo).not.toBe("#f97316");
      expect(orRo).not.toBe("#e11d48");
    });

    it("reaches red at the 90% threshold and holds it through the final zone", () => {
      const { u90 } = GAUGE_ARC_ZONE_STOPS;
      expect(gaugeFillHexAtArcU(u90, false)).toBe("#e11d48");
      expect(gaugeFillHexAtArcU((u90 + 1) / 2, false)).toBe("#e11d48");
    });

    it("gaugeFillHexAtArcT delegates to arc sampling", () => {
      expect(gaugeFillHexAtArcT(0, false)).toBe(gaugeFillHexAtArcU(0, false));
      expect(gaugeFillHexAtArcT(1, false)).toBe(gaugeFillHexAtArcU(1, false));
    });
  });

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

  describe("gaugeBandedStrokeClassAtArcT", () => {
    it("maps arc t to zone stroke classes", () => {
      expect(gaugeBandedStrokeClassAtArcT(0)).toContain("emerald");
      expect(gaugeBandedStrokeClassAtArcT(0.75)).toContain("amber");
      expect(gaugeBandedStrokeClassAtArcT(0.85)).toContain("orange");
      expect(gaugeBandedStrokeClassAtArcT(0.95)).toContain("rose");
      expect(gaugeBandedStrokeClassAtArcT(1)).toContain("rose");
    });
  });
});
