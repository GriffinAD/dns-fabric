/**
 * Upper semicircle in SVG (∩): chord from (cx−r, cy) to (cx+r, cy), bulge toward smaller y.
 * Chord sits low in the mini viewBox; the arc fits above it without clipping.
 */

/** Full track along the upper semicircle (bulge toward smaller y). Sweep must be 1 here — sweep 0 draws the lower “U”. */
export function describeSemicircleArc(cx: number, cy: number, r: number): string {
  const x0 = cx - r;
  const y0 = cy;
  const x1 = cx + r;
  const y1 = cy;
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
}
