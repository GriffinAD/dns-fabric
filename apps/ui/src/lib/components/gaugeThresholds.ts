/**
 * Fixed colour bands along the **arc** (0–100% of path length): 0–70% green,
 * 70–80% yellow, 80–90% orange, 90–100% red. The **value** reveals how far
 * along that spectrum the fill runs (e.g. 95% shows all four colours on the
 * filled portion).
 */

const ZONES = [
  { t0: 0, t1: 0.7, className: "stroke-emerald-600 dark:stroke-emerald-400" },
  { t0: 0.7, t1: 0.8, className: "stroke-amber-500 dark:stroke-amber-300" },
  { t0: 0.8, t1: 0.9, className: "stroke-orange-500 dark:stroke-orange-400" },
  { t0: 0.9, t1: 1, className: "stroke-rose-600 dark:stroke-rose-400" },
] as const;

export type GaugeArcSegment = {
  /** Start fraction along full semicircle track [0, 1). */
  t0: number;
  /** End fraction (exclusive of path end only if value stops short). */
  t1: number;
  className: string;
};

/**
 * Returns 0–4 visible sub-segments for a fill amount `percent` (0–100).
 * Each segment maps to a sub-arc `t0`–`t1` on the same semicircle parameterization.
 */
export function gaugeArcSegmentsForFill(percent: number): GaugeArcSegment[] {
  const n = Number(percent);
  if (!Number.isFinite(n) || n <= 0) {
    return [];
  }
  const fill = Math.max(0, Math.min(100, n)) / 100;
  const out: GaugeArcSegment[] = [];
  for (const z of ZONES) {
    if (fill <= z.t0) {
      break;
    }
    const seg0 = z.t0;
    const seg1 = Math.min(fill, z.t1);
    if (seg1 > seg0) {
      out.push({ t0: seg0, t1: seg1, className: z.className });
    }
  }
  return out;
}
