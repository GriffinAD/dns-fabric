/** Narrow `/dashboard` section payloads for display-only rendering. */

export function asRecord(p: unknown): Record<string, unknown> | null {
  if (p !== null && typeof p === "object" && !Array.isArray(p)) {
    return p as Record<string, unknown>;
  }
  return null;
}

export function boolish(v: unknown): boolean {
  return v === true;
}

export function str(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Docker dashboard rows use `status: "not_found"` when the name is absent on this host — omit from UI. */
export function isDeployedContainerRow(row: unknown): boolean {
  const r = asRecord(row);
  if (!r) return false;
  const st = typeof r.status === "string" ? r.status.trim().toLowerCase() : "";
  return st !== "not_found";
}

export function filterDeployedContainerRows(rows: unknown): unknown[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isDeployedContainerRow);
}

/** One lifecycle label: prefer Docker `State.Status`, else `running` flag. */
export function containerLifecycleLabel(row: unknown): string {
  const r = asRecord(row);
  if (!r) return "unknown";
  if (typeof r.status === "string" && r.status.trim().length > 0) {
    return r.status.trim();
  }
  if (r.running === true) return "running";
  if (r.running === false) return "stopped";
  return "unknown";
}

/** Non-healthy health values only (healthy is implied when omitted). */
export function containerHealthSuffix(row: unknown): string | null {
  const r = asRecord(row);
  if (!r || typeof r.health !== "string" || r.health.trim().length === 0) return null;
  const h = r.health.trim().toLowerCase();
  if (h === "healthy") return null;
  return r.health.trim();
}

export type ContainerTone = "ok" | "warn" | "bad" | "neutral";

export function containerLifecycleTone(row: unknown): ContainerTone {
  const label = containerLifecycleLabel(row).toLowerCase();
  if (label === "running") return "ok";
  if (label.includes("error") || label === "dead") return "bad";
  if (label.includes("restart")) return "warn";
  return "neutral";
}

/** Short human label for elapsed time (e.g. `2d 4h`, `38m`, `9s`). */
export function formatElapsedMs(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "—";
  const sec = Math.floor(elapsedMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 48) {
    const remM = min % 60;
    return remM === 0 ? `${hrs}h` : `${hrs}h ${remM}m`;
  }
  const days = Math.floor(hrs / 24);
  const remH = hrs % 24;
  return remH === 0 ? `${days}d` : `${days}d ${remH}h`;
}

/**
 * Uptime label for a Docker/stack row when the API includes `started_at` (RFC3339) or
 * `uptime_seconds`. Only shown while lifecycle resolves to `running`. `nowMs` is the viewer clock.
 */
export function containerUptimeLabel(row: unknown, nowMs: number): string | null {
  const r = asRecord(row);
  if (!r) return null;
  if (containerLifecycleLabel(r).trim().toLowerCase() !== "running") return null;
  const upSec = r.uptime_seconds;
  if (typeof upSec === "number" && Number.isFinite(upSec) && upSec >= 0) {
    return formatElapsedMs(upSec * 1000);
  }
  const started = typeof r.started_at === "string" ? r.started_at.trim() : "";
  if (started.length === 0) return null;
  const t = Date.parse(started);
  if (!Number.isFinite(t)) return null;
  return formatElapsedMs(nowMs - t);
}
