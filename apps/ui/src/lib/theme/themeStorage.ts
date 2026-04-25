import { z } from "zod";

const STORAGE_KEY = "kea-fabric-ui-theme";

export const colorPresetSchema = z.enum(["default", "emerald", "gray"]);
export const themeModeSchema = z.enum(["light", "dark", "system"]);
export const gaugeCapStyleSchema = z.enum(["rounded", "flat"]);

/** Normalized angular gap between discrete arc blocks (0–1); see `SemicircleGauge` discrete cells. */
export const GAUGE_SEGMENT_GAP_MIN = 0;
export const GAUGE_SEGMENT_GAP_MAX = 1;
/** Default gap between block centres when segmented arc is enabled; unused when division count is 0. */
export const DEFAULT_GAUGE_SEGMENT_GAP = 0.2;
/** Default arc divisions for new installs (0 = smooth continuous arc). */
export const DEFAULT_GAUGE_SEGMENT_DIVISIONS = 0;
/** Old theme JSON had only `gaugeSegmentLines: true` — treat as this many blocks. */
export const LEGACY_GAUGE_SEGMENT_DIVISIONS = 20;
export const GAUGE_SEGMENT_DIVISIONS_MIN = 0;
export const GAUGE_SEGMENT_DIVISIONS_MAX = 100;

/**
 * Clamp arc division count to [0, 100]. Non-finite values fall back to {@link DEFAULT_GAUGE_SEGMENT_DIVISIONS} (0).
 * **0** = smooth continuous arc; **1–100** = that many discrete blocks.
 */
export function clampGaugeSegmentDivisions(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return DEFAULT_GAUGE_SEGMENT_DIVISIONS;
  }
  return Math.min(
    GAUGE_SEGMENT_DIVISIONS_MAX,
    Math.max(GAUGE_SEGMENT_DIVISIONS_MIN, Math.round(n)),
  );
}

/**
 * Clamp stored segment gap to [0, 1]. Values in (1, 10] are treated as legacy SVG-px scale (/10).
 */
export function clampGaugeSegmentGap(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return DEFAULT_GAUGE_SEGMENT_GAP;
  }
  if (n >= GAUGE_SEGMENT_GAP_MIN && n <= GAUGE_SEGMENT_GAP_MAX) {
    return n;
  }
  if (n > GAUGE_SEGMENT_GAP_MAX && n <= 10) {
    return Math.min(GAUGE_SEGMENT_GAP_MAX, Math.max(GAUGE_SEGMENT_GAP_MIN, n / 10));
  }
  if (n > 10) {
    return GAUGE_SEGMENT_GAP_MAX;
  }
  return GAUGE_SEGMENT_GAP_MIN;
}

/**
 * Block count actually applied to the document / gauge (0 = no segmented drawing).
 * When segmented arc is on but the stored count is 0, uses {@link LEGACY_GAUGE_SEGMENT_DIVISIONS}.
 */
export function getEffectiveGaugeSegmentDivisions(
  segmentArcEnabled: boolean,
  storedDivisions: number,
): number {
  if (!segmentArcEnabled) {
    return 0;
  }
  const d = clampGaugeSegmentDivisions(storedDivisions);
  return d > 0 ? d : LEGACY_GAUGE_SEGMENT_DIVISIONS;
}

/**
 * Reads `data-gauge-segment-enabled` when set; otherwise infers from legacy
 * `data-gauge-segment-lines` / `data-gauge-segment-divisions` (older HTML).
 */
export function gaugeSegmentEnabledFromDataAttrs(root: HTMLElement): boolean {
  const e = root.dataset.gaugeSegmentEnabled;
  if (e === "0" || e === "false") return false;
  if (e === "1" || e === "true") return true;
  if (root.dataset.gaugeSegmentLines === "0") return false;
  if (root.dataset.gaugeSegmentLines === "1") return true;
  const raw = root.dataset.gaugeSegmentDivisions;
  if (raw !== undefined && raw !== "" && !Number.isNaN(Number(raw))) {
    return clampGaugeSegmentDivisions(Number(raw)) > 0;
  }
  return false;
}

/**
 * Block count for gauge rendering: same rules as {@link getEffectiveGaugeSegmentDivisions},
 * from document `data-gauge-*` (must stay consistent with {@link applyDocumentTheme}).
 * When segments are off, returns **0** even if `data-gauge-segment-divisions` is stale.
 */
export function effectiveGaugeSegmentDivisionsFromDataAttrs(root: HTMLElement): number {
  const enabled = gaugeSegmentEnabledFromDataAttrs(root);
  const raw = root.dataset.gaugeSegmentDivisions;
  const stored =
    raw !== undefined && raw !== "" && !Number.isNaN(Number(raw))
      ? clampGaugeSegmentDivisions(Number(raw))
      : root.dataset.gaugeSegmentLines === "1"
        ? LEGACY_GAUGE_SEGMENT_DIVISIONS
        : DEFAULT_GAUGE_SEGMENT_DIVISIONS;
  return getEffectiveGaugeSegmentDivisions(enabled, stored);
}

const themePreferencesSchema = z.object({
  version: z.literal(1),
  mode: themeModeSchema,
  colorPreset: colorPresetSchema,
  gaugeCapStyle: gaugeCapStyleSchema.optional(),
  /** Draw discrete arc blocks. Stored block count is kept even when this is off. */
  gaugeSegmentEnabled: z.boolean().optional(),
  /** Legacy: prefer `gaugeSegmentDivisions` when present. */
  gaugeSegmentLines: z.boolean().optional(),
  gaugeSegmentDivisions: z.number().int().min(0).max(100).optional(),
  gaugeSegmentGapPx: z.number().finite().optional(),
});

/** Stored + resolved fields (defaults applied when optional keys are omitted in JSON). */
export type ThemePreferences = z.infer<typeof themePreferencesSchema> & {
  gaugeCapStyle: GaugeCapStyle;
  /** Preferred block count (1–100; 0 = default to legacy count when {@link gaugeSegmentEnabled}). */
  gaugeSegmentDivisions: number;
  /** When false, the gauge does not draw blocks; `gaugeSegmentDivisions` is still stored. */
  gaugeSegmentEnabled: boolean;
  /** Legacy mirror: `gaugeSegmentEnabled && gaugeSegmentDivisions > 0`. */
  gaugeSegmentLines: boolean;
  /** 0–1 scale; angular gap between discrete arc blocks in `SemicircleGauge` (JSON key remains `gaugeSegmentGapPx`). */
  gaugeSegmentGapPx: number;
};
export type ThemePreferencesPartial = z.infer<typeof themePreferencesSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export type ColorPreset = z.infer<typeof colorPresetSchema>;
export type GaugeCapStyle = z.infer<typeof gaugeCapStyleSchema>;

const DEFAULT_PREFERENCES: ThemePreferences = {
  version: 1,
  mode: "system",
  colorPreset: "default",
  gaugeCapStyle: "flat",
  gaugeSegmentDivisions: DEFAULT_GAUGE_SEGMENT_DIVISIONS,
  gaugeSegmentEnabled: false,
  gaugeSegmentLines: false,
  gaugeSegmentGapPx: DEFAULT_GAUGE_SEGMENT_GAP,
};

function resolveGaugeSegmentDivisions(p: ThemePreferencesPartial): number {
  if (typeof p.gaugeSegmentDivisions === "number" && Number.isFinite(p.gaugeSegmentDivisions)) {
    return clampGaugeSegmentDivisions(p.gaugeSegmentDivisions);
  }
  if (p.gaugeSegmentLines === false) {
    return 0;
  }
  if (p.gaugeSegmentLines === true) {
    return LEGACY_GAUGE_SEGMENT_DIVISIONS;
  }
  return DEFAULT_GAUGE_SEGMENT_DIVISIONS;
}

function mergeThemePreferences(p: ThemePreferencesPartial): ThemePreferences {
  const gaugeSegmentDivisions = resolveGaugeSegmentDivisions(p);
  const gaugeSegmentEnabled =
    typeof p.gaugeSegmentEnabled === "boolean"
      ? p.gaugeSegmentEnabled
      : gaugeSegmentDivisions > 0;
  return {
    ...p,
    gaugeCapStyle: p.gaugeCapStyle ?? "flat",
    gaugeSegmentDivisions,
    gaugeSegmentEnabled,
    gaugeSegmentLines: gaugeSegmentEnabled && gaugeSegmentDivisions > 0,
    gaugeSegmentGapPx: clampGaugeSegmentGap(p.gaugeSegmentGapPx ?? DEFAULT_GAUGE_SEGMENT_GAP),
  };
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getEffectiveIsDark(mode: ThemeMode, prefersDark: boolean): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return prefersDark;
}

export function loadThemePreferences(): ThemePreferences {
  if (typeof localStorage === "undefined") {
    return DEFAULT_PREFERENCES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = themePreferencesSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? mergeThemePreferences(parsed.data) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveThemePreferences(p: ThemePreferencesPartial): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeThemePreferences(p)));
}

/**
 * Set `class="dark"` on the document element when the effective appearance is dark.
 * Set `data-color-preset` for Flowbite primary palette overrides in app.css.
 * Gauge options: `data-gauge-segment-enabled` (0/1), `data-gauge-segment-divisions` (effective 0–100),
 * `data-gauge-segment-lines` (legacy mirror), `data-gauge-segment-gap` (0–1, spacing when segmented).
 */
export function applyDocumentTheme(
  mode: ThemeMode,
  colorPreset: ColorPreset,
  prefersDark: boolean,
  gaugeCapStyle: GaugeCapStyle = "flat",
  gaugeSegmentEnabled: boolean = false,
  gaugeSegmentDivisions: number = DEFAULT_GAUGE_SEGMENT_DIVISIONS,
  gaugeSegmentGapPx: number = DEFAULT_GAUGE_SEGMENT_GAP,
): { effectiveIsDark: boolean } {
  const effectiveIsDark = getEffectiveIsDark(mode, prefersDark);
  const root = document.documentElement;
  if (effectiveIsDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.dataset.colorPreset = colorPreset;
  root.dataset.gaugeCapStyle = gaugeCapStyle;
  const effective = getEffectiveGaugeSegmentDivisions(
    gaugeSegmentEnabled,
    clampGaugeSegmentDivisions(gaugeSegmentDivisions),
  );
  root.dataset.gaugeSegmentEnabled = gaugeSegmentEnabled ? "1" : "0";
  root.dataset.gaugeSegmentDivisions = String(effective);
  root.dataset.gaugeSegmentLines = effective > 0 ? "1" : "0";
  root.dataset.gaugeSegmentGap = String(clampGaugeSegmentGap(gaugeSegmentGapPx));
  delete root.dataset.gaugeSegmentGapPx;
  return { effectiveIsDark };
}

export function resyncDocumentThemeFromStorage(): void {
  const p = loadThemePreferences();
  applyDocumentTheme(
    p.mode,
    p.colorPreset,
    getSystemPrefersDark(),
    p.gaugeCapStyle,
    p.gaugeSegmentEnabled,
    p.gaugeSegmentDivisions,
    p.gaugeSegmentGapPx,
  );
}
