import { z } from "zod";

const STORAGE_KEY = "kea-fabric-dashboard-settings";

/** Upper bound avoids accidentally setting absurd gaps that break the 12-track math. */
export const DASHBOARD_GAP_MIN_PX = 0;
export const DASHBOARD_GAP_MAX_PX = 32;

const dashboardSettingsSchema = z.object({
  version: z.literal(1),
  /** Uniform CSS grid gap between tiles (both rows and columns), in px. */
  gapPx: z
    .number()
    .int()
    .min(DASHBOARD_GAP_MIN_PX)
    .max(DASHBOARD_GAP_MAX_PX),
});

export type DashboardSettings = z.infer<typeof dashboardSettingsSchema>;

const DEFAULT_SETTINGS: DashboardSettings = {
  version: 1,
  gapPx: 8,
};

export function loadDashboardSettings(): DashboardSettings {
  if (typeof localStorage === "undefined") {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = dashboardSettingsSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveDashboardSettings(s: DashboardSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/**
 * Applies the gap to `--dashboard-gap` on the document root. Both dashboard grids
 * (editor + read-only) read this variable via `app.css`, as does `--d-gap` which
 * feeds the column-guide ruler. Keep changes through this function so grid and
 * ruler stay in lock-step.
 */
export function applyDocumentDashboardSettings(s: DashboardSettings): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--dashboard-gap", `${s.gapPx}px`);
}

export function clampGapPx(n: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_SETTINGS.gapPx;
  return Math.max(DASHBOARD_GAP_MIN_PX, Math.min(DASHBOARD_GAP_MAX_PX, v));
}
