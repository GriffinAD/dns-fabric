import { parseDashboardLayoutZod } from "./layoutZod";
import type { DashboardLayout } from "./types";

export const DASHBOARD_LAYOUT_STORAGE_KEY = "kea-fabric-dashboard-layout";

let layoutLocalPersistBlocked = false;
let layoutLocalPersistBlockedReason: string | null = null;

/**
 * Test helper only — do not call from the shipped UI. Sets the same module-level flags as an
 * unsupported stored layout version, so `saveDashboardLayout` warning branches can be asserted.
 */
export function setLocalPersistBlockedStateForTest(blocked: boolean, reason: string | null): void {
  layoutLocalPersistBlocked = blocked;
  layoutLocalPersistBlockedReason = reason;
}

function resetLayoutLocalPersistGate(): void {
  layoutLocalPersistBlocked = false;
  layoutLocalPersistBlockedReason = null;
}

/** True after `loadDashboardLayout` / hydrate sees layout JSON with version &gt; 3. */
export function isLayoutLocalPersistBlocked(): boolean {
  return layoutLocalPersistBlocked;
}

export function getLayoutLocalPersistBlockedReason(): string | null {
  return layoutLocalPersistBlockedReason;
}

/** Clear gate after trusted server layout, baseline reset, or explicit storage clear. */
export function clearLayoutLocalPersistGate(): void {
  resetLayoutLocalPersistGate();
}

/** Remove stored layout and allow local saves again (e.g. user acknowledges incompatible client). */
export function clearStoredDashboardLayoutAndUnlock(): void {
  resetLayoutLocalPersistGate();
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(DASHBOARD_LAYOUT_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** When set, stored JSON is newer than this app supports (see `docs/planning/UI_ENGINE_PLAN.md` P3.7). */
export function layoutJsonUnsupportedVersionMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "number") return null;
  if (v.version > 3) {
    return `Dashboard layout version ${v.version} is not supported (this app accepts versions 1–3 only).`;
  }
  return null;
}

export function parseDashboardLayout(value: unknown): DashboardLayout | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "number" || v.version < 1) return null;
  if (layoutJsonUnsupportedVersionMessage(value) != null) return null;
  return parseDashboardLayoutZod(value);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `Dashboard_Layout_{yyyy-MM-dd_hhmmss}.json` using local wall-clock time. */
export function dashboardLayoutExportFilename(date = new Date()): string {
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const s = pad2(date.getSeconds());
  return `Dashboard_Layout_${y}-${mo}-${d}_${h}${mi}${s}.json`;
}

export function buildDashboardLayoutDownloadPayload(layout: DashboardLayout): string {
  return `${JSON.stringify(layout, null, 2)}\n`;
}

/** Browser download of layout JSON (optional filename, e.g. from server snapshot basename). */
export function downloadDashboardLayoutFile(layout: DashboardLayout, downloadFilename?: string): void {
  if (typeof document === "undefined") return;
  const body = buildDashboardLayoutDownloadPayload(layout);
  const blob = new Blob([body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadFilename ?? dashboardLayoutExportFilename();
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function loadDashboardLayout(): DashboardLayout | null {
  if (typeof localStorage === "undefined") return null;
  resetLayoutLocalPersistGate();
  try {
    const raw = localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const unsup = layoutJsonUnsupportedVersionMessage(parsed);
    if (unsup != null) {
      layoutLocalPersistBlocked = true;
      layoutLocalPersistBlockedReason = unsup;
      console.warn(`[layoutStorage] ${unsup} — ignoring stored layout; local layout cache writes disabled until resolved.`);
      return null;
    }
    return parseDashboardLayout(parsed);
  } catch {
    return null;
  }
}

export function saveDashboardLayout(layout: DashboardLayout): void {
  if (typeof localStorage === "undefined") return;
  if (layoutLocalPersistBlocked) {
    console.warn(
      `[layoutStorage] skipped local save (layout cache locked: ${layoutLocalPersistBlockedReason ?? "unknown"})`,
    );
    return;
  }
  localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

