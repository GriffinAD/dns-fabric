/** Semicircle gauge geometry: arc from 180° to 0° (top half), percent 0–100. */

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Returns SVG path d for semicircle arc from left (180°) to right (0°). */
export function describeSemicircleArc(cx: number, cy: number, r: number): string {
  const start = polarToCartesian(cx, cy, r, 180);
  const end = polarToCartesian(cx, cy, r, 0);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
}

/**
 * Arc covering `percent` of the semicircle (0 = none, 100 = full half-circle).
 */
export function describeSemicircleProgress(cx: number, cy: number, r: number, percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  const endAngle = 180 - (p / 100) * 180;
  const start = polarToCartesian(cx, cy, r, 180);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = p > 50 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
