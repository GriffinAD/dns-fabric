const PINNED_KEY = "kea-fabric-palette-pinned";
const RECENT_KEY = "kea-fabric-palette-recent";
const DOCK_MODE_KEY = "kea-fabric-palette-dock";
const MAX_RECENT = 12;
const MAX_PINNED = 24;

/** Where the edit palette sits relative to the dashboard while scrolling. */
export type PaletteDockMode = "inline" | "sticky" | "float";

export function normalizePaletteDockMode(value: unknown): PaletteDockMode {
  if (value === "inline" || value === "sticky" || value === "float") return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "inline" || t === "sticky" || t === "float") return t;
  }
  return "float";
}

export function loadPaletteDockMode(): PaletteDockMode {
  if (typeof localStorage === "undefined") return "float";
  try {
    const raw = localStorage.getItem(DOCK_MODE_KEY);
    if (raw == null || raw === "") return "float";
    try {
      return normalizePaletteDockMode(JSON.parse(raw) as unknown);
    } catch {
      return normalizePaletteDockMode(raw);
    }
  } catch {
    return "float";
  }
}

export function savePaletteDockMode(mode: PaletteDockMode): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DOCK_MODE_KEY, JSON.stringify(mode));
  } catch {
    /* ignore */
  }
}

function readJsonArray(key: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 300);
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** Deduplicate while preserving order; cap length. */
export function capDedupeIds(ids: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= cap) break;
  }
  return out;
}

export function loadPinnedPaletteIds(): string[] {
  return capDedupeIds(readJsonArray(PINNED_KEY), MAX_PINNED);
}

export function savePinnedPaletteIds(ids: string[]): void {
  writeJsonArray(PINNED_KEY, capDedupeIds(ids, MAX_PINNED));
}

export function loadRecentPaletteIds(): string[] {
  return capDedupeIds(readJsonArray(RECENT_KEY), MAX_RECENT);
}

export function recordRecentPaletteId(pluginId: string): void {
  const cur = loadRecentPaletteIds().filter((x) => x !== pluginId);
  writeJsonArray(RECENT_KEY, capDedupeIds([pluginId, ...cur], MAX_RECENT));
}
