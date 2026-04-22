import { describe, expect, it } from "vitest";

import { describeSemicircleArc } from "./gaugeMath";

describe("gaugeMath", () => {
  it("describeSemicircleArc is upper semicircle left to right", () => {
    expect(describeSemicircleArc(50, 50, 40)).toBe("M 10 50 A 40 40 0 0 1 90 50");
  });
});
