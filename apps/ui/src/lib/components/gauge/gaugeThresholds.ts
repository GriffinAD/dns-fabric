/**
 * Fixed colour bands along the **arc** (0–100% of path length): 0–70% green,
 * 70–80% yellow, 80–90% orange, 90–100% red. The **value** reveals how far
 * along that spectrum the fill runs (e.g. 95% shows all four colours on the
 * filled portion).
 *
 * **Rendering (smooth):** the value arc is split at the same 70/80/90%
 * path-length thresholds and each zone is painted with a short SVG gradient.
 *
 * **Banded** mode uses one solid colour per zone from `gaugeBandedStrokeClassAtArcT` (same `t`).
 */

/** Clamp an arc fraction to the shared [0, 1] gauge domain. */
export function clampGaugeArcT(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** Arc-length threshold boundaries shared by smooth and banded gauge fills. */
export const GAUGE_ARC_ZONE_STOPS = {
  u70: 0.70,
  u80: 0.80,
  u90: 0.90,
} as const;

/** Matches `--gauge-z-*` in app.css for custom stroke caps (smooth / banded). */
const HEX_LIGHT = {
  emerald: "#059669",
  amber: "#f59e0b",
  orange: "#f97316",
  rose: "#e11d48",
} as const;
const HEX_DARK = {
  emerald: "#34d399",
  amber: "#fcd34d",
  orange: "#fb923c",
  /** Deeper than rose-400 so the high zone reads clearly red, not pink, on dark tiles. */
  rose: "#e11d48",
} as const;

function lerpByte(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpHex(h0: string, h1: string, t: number): string {
  const n0 = parseInt(h0.slice(1), 16);
  const n1 = parseInt(h1.slice(1), 16);
  const r0 = (n0 >> 16) & 255;
  const g0 = (n0 >> 8) & 255;
  const b0 = n0 & 255;
  const r1 = (n1 >> 16) & 255;
  const g1 = (n1 >> 8) & 255;
  const b1 = n1 & 255;
  const tt = Math.max(0, Math.min(1, t));
  const r = lerpByte(r0, r1, tt);
  const g = lerpByte(g0, g1, tt);
  const b = lerpByte(b0, b1, tt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Smooth lerp in [0, 1] at **arc** fraction `u` (same 70/80/90% breaks as `ZONES`). */
export function gaugeFillHexAtArcU(u: number, isDark: boolean): string {
  const z = isDark ? HEX_DARK : HEX_LIGHT;
  const { u70, u80, u90 } = GAUGE_ARC_ZONE_STOPS;
  const u85 = (u80 + u90) / 2;
  const uu = clampGaugeArcT(u);
  if (uu <= u70) return z.emerald;
  if (uu <= u80) return lerpHex(z.emerald, z.amber, (uu - u70) / (u80 - u70));
  if (uu <= u85) return lerpHex(z.amber, z.orange, (uu - u80) / (u85 - u80));
  if (uu <= u90) return lerpHex(z.orange, z.rose, (uu - u85) / (u90 - u85));
  return z.rose;
}

/** Solid fill at arc parameter `t` in [0, 1] (same sampling as the SVG gradients). */
export function gaugeFillHexAtArcT(t: number, isDark: boolean): string {
  return gaugeFillHexAtArcU(t, isDark);
}

const ZONES = [
  { t0: 0, t1: GAUGE_ARC_ZONE_STOPS.u70, className: "stroke-emerald-600 dark:stroke-emerald-400" },
  { t0: GAUGE_ARC_ZONE_STOPS.u70, t1: GAUGE_ARC_ZONE_STOPS.u80, className: "stroke-amber-500 dark:stroke-amber-300" },
  { t0: GAUGE_ARC_ZONE_STOPS.u80, t1: GAUGE_ARC_ZONE_STOPS.u90, className: "stroke-orange-500 dark:stroke-orange-400" },
  { t0: GAUGE_ARC_ZONE_STOPS.u90, t1: 1, className: "stroke-rose-600 dark:stroke-rose-600" },
] as const;

/** Solid banded stroke class at arc parameter `t` ∈ [0, 1] (for discrete gauge chunks). */
export function gaugeBandedStrokeClassAtArcT(t: number): string {
  const tt = Math.max(0, Math.min(1, t));
  for (const z of ZONES) {
    if (tt >= z.t0 && tt < z.t1) {
      return z.className;
    }
  }
  return ZONES[ZONES.length - 1]!.className;
}

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
