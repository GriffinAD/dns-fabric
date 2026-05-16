/** Duration for gauge arc + readout when the target percent changes. */
export const GAUGE_DISPLAY_TWEEN_MS = 500;

export function clampGaugePercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function gaugeDisplayTweenDuration(opts: {
  reducedMotion: boolean;
  instant: boolean;
  durationMs?: number;
}): number {
  if (opts.reducedMotion || opts.instant) return 0;
  return opts.durationMs ?? GAUGE_DISPLAY_TWEEN_MS;
}

export function prefersReducedMotion(): boolean {
  if (typeof matchMedia === "undefined") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}
