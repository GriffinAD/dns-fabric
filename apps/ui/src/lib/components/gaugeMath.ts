/**
 * Upper semicircle in SVG (∩): chord from (cx−r, cy) to (cx+r, cy), bulge toward smaller y.
 * Chord sits low in the mini viewBox; the arc fits above it without clipping.
 *
 * `t0`, `t1` in `describeSemicircleSegment` are a fraction in [0, 1] along the **same** track
 * as the full semicircle: 0 = start (left), 1 = end (right) along the upper arc.
 */

function semicirclePoint(cx: number, cy: number, r: number, t: number) {
  if (t <= 0) {
    return { x: cx - r, y: cy };
  }
  if (t >= 1) {
    return { x: cx + r, y: cy };
  }
  const phi = Math.PI * (1 - t);
  return { x: cx + r * Math.cos(phi), y: cy - r * Math.sin(phi) };
}

/** Sub-arc from `t0` to `t1` (0 = left end of the upper semicircle, 1 = right). */
export function describeSemicircleSegment(cx: number, cy: number, r: number, t0: number, t1: number): string {
  if (!(t1 > t0)) {
    return "";
  }
  const p0 = semicirclePoint(cx, cy, r, t0);
  const p1 = semicirclePoint(cx, cy, r, t1);
  // Upper-semicircle sub-arcs for t in [0,1] are always at most 70% of the half circle (< 180°).
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}`;
}

/** Full track along the upper semicircle (bulge toward smaller y). Sweep must be 1 here — sweep 0 draws the lower “U”. */
export function describeSemicircleArc(cx: number, cy: number, r: number): string {
  return describeSemicircleSegment(cx, cy, r, 0, 1);
}
