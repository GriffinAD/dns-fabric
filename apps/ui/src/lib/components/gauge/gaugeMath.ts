/**
 * 240° gauge arc through the top: from −120° to +120° measured from 12 o’clock
 * (symmetric opening at the bottom). `t` ∈ [0, 1] is uniform along the arc (0 = left, 1 = right).
 *
 * Uses standard math angles θ CCW from +x with y = cy − r sin θ (SVG y-down).
 */

/** Left endpoint θ = 7π/6 (210°); right endpoint θ = −π/6 (11π/6). */
export const GAUGE_ARC_THETA_LEFT = (7 * Math.PI) / 6;
export const GAUGE_ARC_THETA_RIGHT = -Math.PI / 6;
/** Central angle along the track (240°). */
export const GAUGE_ARC_SWEEP_RAD = (4 * Math.PI) / 3;

/** cos(π/6); chord half-width / r for the horizontal chord through both endpoints. */
export const GAUGE_ARC_COS_END = Math.cos(Math.PI / 6);

export function gaugeArcThetaFromT(t: number): number {
  if (t <= 0) return GAUGE_ARC_THETA_LEFT;
  if (t >= 1) return GAUGE_ARC_THETA_RIGHT;
  return GAUGE_ARC_THETA_LEFT - t * GAUGE_ARC_SWEEP_RAD;
}

export function semicirclePoint(cx: number, cy: number, r: number, t: number) {
  const theta = gaugeArcThetaFromT(t);
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

/** Radial segment through the stroke band at arc parameter t (inner → outer edge of the thick arc). */
export function gaugeRadialThroughStroke(
  cx: number,
  cy: number,
  rTrack: number,
  strokeW: number,
  t: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const p = semicirclePoint(cx, cy, rTrack, t);
  const ux = (p.x - cx) / rTrack;
  const uy = (p.y - cy) / rTrack;
  const half = strokeW / 2;
  return {
    x1: cx + ux * (rTrack - half),
    y1: cy + uy * (rTrack - half),
    x2: cx + ux * (rTrack + half),
    y2: cy + uy * (rTrack + half),
  };
}

/** Sub-arc from `t0` to `t1` (0 = left end, 1 = right) along the 240° track. */
export function describeSemicircleSegment(cx: number, cy: number, r: number, t0: number, t1: number): string {
  if (!(t1 > t0)) {
    return "";
  }
  const p0 = semicirclePoint(cx, cy, r, t0);
  const p1 = semicirclePoint(cx, cy, r, t1);
  const sweepAngle = (t1 - t0) * GAUGE_ARC_SWEEP_RAD;
  const largeArc = sweepAngle > Math.PI ? 1 : 0;
  const sweep = 1;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${p1.x} ${p1.y}`;
}

/** Full track along the 240° arc. */
export function describeSemicircleArc(cx: number, cy: number, r: number): string {
  return describeSemicircleSegment(cx, cy, r, 0, 1);
}
