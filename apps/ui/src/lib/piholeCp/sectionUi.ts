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
