export type GaugePercentBand = "green" | "yellow" | "orange" | "red";

/**
 * Half-open ranges: [0, 70) green, [70, 80) yellow, [80, 90) orange, [90, 100] red.
 * So 0% is green, 70.0% is yellow, 100% is red.
 */
export function gaugePercentBand(percent: number): GaugePercentBand {
  const n = Number(percent);
  if (!Number.isFinite(n)) return "green";
  const clamped = Math.max(0, Math.min(100, n));
  if (clamped < 70) return "green";
  if (clamped < 80) return "yellow";
  if (clamped < 90) return "orange";
  return "red";
}

/** Tailwind `stroke-*` classes for the gauge progress arc (light + dark). */
export function gaugeProgressStrokeClass(percent: number): string {
  const b = gaugePercentBand(percent);
  if (b === "green") return "stroke-emerald-600 dark:stroke-emerald-400";
  if (b === "yellow") return "stroke-amber-500 dark:stroke-amber-300";
  if (b === "orange") return "stroke-orange-500 dark:stroke-orange-400";
  return "stroke-rose-600 dark:stroke-rose-400";
}
