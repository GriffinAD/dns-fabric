import { describe, expect, it } from "vitest";

import {
  clampGaugePercent,
  gaugeDisplayTweenDuration,
  GAUGE_DISPLAY_TWEEN_MS,
  prefersReducedMotion,
} from "./gaugeDisplay";

describe("gaugeDisplay", () => {
  it("clamps and sanitizes percent", () => {
    expect(clampGaugePercent(50)).toBe(50);
    expect(clampGaugePercent(150)).toBe(100);
    expect(clampGaugePercent(-1)).toBe(0);
    expect(clampGaugePercent(Number.NaN)).toBe(0);
  });

  it("returns zero duration when instant or reduced motion", () => {
    expect(gaugeDisplayTweenDuration({ reducedMotion: true, instant: false })).toBe(0);
    expect(gaugeDisplayTweenDuration({ reducedMotion: false, instant: true })).toBe(0);
  });

  it("returns default tween ms otherwise", () => {
    expect(gaugeDisplayTweenDuration({ reducedMotion: false, instant: false })).toBe(
      GAUGE_DISPLAY_TWEEN_MS,
    );
    expect(gaugeDisplayTweenDuration({ reducedMotion: false, instant: false, durationMs: 120 })).toBe(
      120,
    );
  });

  it("prefersReducedMotion is false when matchMedia is unavailable", () => {
    const prev = globalThis.matchMedia;
    // @ts-expect-error test shim
    delete globalThis.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
    globalThis.matchMedia = prev;
  });
});
