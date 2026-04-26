const PINNED_KEY = "kea-fabric-palette-pinned";
const RECENT_KEY = "kea-fabric-palette-recent";
const DOCK_MODE_KEY = "kea-fabric-palette-dock";
const FLOAT_POS_KEY = "kea-fabric-palette-float-pos";
const MAX_RECENT = 12;
const MAX_PINNED = 24;

/** Pixel position of the floating tiles panel (`fixed` top/left). */
export type PaletteFloatPosition = { left: number; top: number };

export function clampPaletteFloatPosition(
  left: number,
  top: number,
  panelWidth: number,
  panelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): PaletteFloatPosition {
  const margin = 8;
  const w = Math.max(1, panelWidth);
  const h = Math.max(1, panelHeight);
  const maxL = Math.max(margin, viewportWidth - w - margin);
  const maxT = Math.max(margin, viewportHeight - h - margin);
  return {
    left: Math.min(maxL, Math.max(margin, left)),
    top: Math.min(maxT, Math.max(margin, top)),
  };
}

/** Default top-right placement before the user drags (or when no saved position). */
export function defaultPaletteFloatPosition(
  viewportWidth: number,
  viewportHeight: number,
  panelWidth = 280,
  panelHeight = 360,
): PaletteFloatPosition {
  return clampPaletteFloatPosition(
    viewportWidth - panelWidth - 16,
    96,
    panelWidth,
    panelHeight,
    viewportWidth,
    viewportHeight,
  );
}

export function loadPaletteFloatPosition(): PaletteFloatPosition | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(FLOAT_POS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const left = Number((v as { left?: unknown }).left);
    const top = Number((v as { top?: unknown }).top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
  } catch {
    return null;
  }
}

export function savePaletteFloatPosition(pos: PaletteFloatPosition | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (pos == null) {
      localStorage.removeItem(FLOAT_POS_KEY);
      return;
    }
    localStorage.setItem(FLOAT_POS_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

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
