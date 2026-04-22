import { describe, expect, it } from "vitest";

import { gaugePercentBand, gaugeProgressStrokeClass } from "./gaugeThresholds";

describe("gaugeThresholds", () => {
  describe("gaugePercentBand", () => {
    it("uses half-open ranges for 70 / 80 / 90", () => {
      expect(gaugePercentBand(0)).toBe("green");
      expect(gaugePercentBand(69.9)).toBe("green");
      expect(gaugePercentBand(70)).toBe("yellow");
      expect(gaugePercentBand(79.9)).toBe("yellow");
      expect(gaugePercentBand(80)).toBe("orange");
      expect(gaugePercentBand(89.9)).toBe("orange");
      expect(gaugePercentBand(90)).toBe("red");
      expect(gaugePercentBand(100)).toBe("red");
    });

    it("clamps out-of-range values", () => {
      expect(gaugePercentBand(-1)).toBe("green");
      expect(gaugePercentBand(500)).toBe("red");
    });

    it("treats non-finite as green", () => {
      expect(gaugePercentBand(Number.NaN)).toBe("green");
    });
  });

  describe("gaugeProgressStrokeClass", () => {
    it("returns tailwind stroke classes for each band", () => {
      expect(gaugeProgressStrokeClass(50)).toContain("emerald");
      expect(gaugeProgressStrokeClass(75)).toContain("amber");
      expect(gaugeProgressStrokeClass(85)).toContain("orange");
      expect(gaugeProgressStrokeClass(95)).toContain("rose");
    });
  });
});
