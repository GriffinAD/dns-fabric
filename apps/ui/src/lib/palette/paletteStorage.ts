const PINNED_KEY = "kea-fabric-palette-pinned";
const RECENT_KEY = "kea-fabric-palette-recent";
const MAX_RECENT = 12;
const MAX_PINNED = 24;

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
