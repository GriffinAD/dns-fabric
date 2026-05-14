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
