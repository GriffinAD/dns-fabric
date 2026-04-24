import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyDocumentTheme,
  clampGaugeSegmentDivisions,
  clampGaugeSegmentGap,
  DEFAULT_GAUGE_SEGMENT_DIVISIONS,
  DEFAULT_GAUGE_SEGMENT_GAP,
  effectiveGaugeSegmentDivisionsFromDataAttrs,
  GAUGE_SEGMENT_DIVISIONS_MAX,
  GAUGE_SEGMENT_GAP_MAX,
  GAUGE_SEGMENT_GAP_MIN,
  getEffectiveIsDark,
  getEffectiveGaugeSegmentDivisions,
  gaugeSegmentEnabledFromDataAttrs,
  getSystemPrefersDark,
  LEGACY_GAUGE_SEGMENT_DIVISIONS,
  loadThemePreferences,
  resyncDocumentThemeFromStorage,
  saveThemePreferences,
} from "./themeStorage";

const KEY = "kea-fabric-ui-theme";

describe("clampGaugeSegmentGap", () => {
  it("returns default for non-number or non-finite values", () => {
    expect(clampGaugeSegmentGap(NaN)).toBe(DEFAULT_GAUGE_SEGMENT_GAP);
    expect(clampGaugeSegmentGap(undefined)).toBe(DEFAULT_GAUGE_SEGMENT_GAP);
    expect(clampGaugeSegmentGap("2" as unknown as number)).toBe(DEFAULT_GAUGE_SEGMENT_GAP);
  });

  it("passes through values in 0–1", () => {
    expect(clampGaugeSegmentGap(0)).toBe(0);
    expect(clampGaugeSegmentGap(0.2)).toBe(0.2);
    expect(clampGaugeSegmentGap(1)).toBe(1);
  });

  it("maps legacy pixel-scale storage (1–10) to 0–1", () => {
    expect(clampGaugeSegmentGap(3.25)).toBe(0.325);
    expect(clampGaugeSegmentGap(10)).toBe(1);
  });

  it("clamps negatives and huge values", () => {
    expect(clampGaugeSegmentGap(-1)).toBe(GAUGE_SEGMENT_GAP_MIN);
    expect(clampGaugeSegmentGap(500)).toBe(GAUGE_SEGMENT_GAP_MAX);
  });
});

describe("clampGaugeSegmentDivisions", () => {
  it("returns default for non-number or non-finite values", () => {
    expect(clampGaugeSegmentDivisions(NaN)).toBe(DEFAULT_GAUGE_SEGMENT_DIVISIONS);
    expect(clampGaugeSegmentDivisions(undefined)).toBe(DEFAULT_GAUGE_SEGMENT_DIVISIONS);
    expect(clampGaugeSegmentDivisions("2" as unknown as number)).toBe(DEFAULT_GAUGE_SEGMENT_DIVISIONS);
  });

  it("clamps to 0–100 and rounds", () => {
    expect(clampGaugeSegmentDivisions(0)).toBe(0);
    expect(clampGaugeSegmentDivisions(100)).toBe(100);
    expect(clampGaugeSegmentDivisions(33.7)).toBe(34);
    expect(clampGaugeSegmentDivisions(-3)).toBe(0);
    expect(clampGaugeSegmentDivisions(500)).toBe(GAUGE_SEGMENT_DIVISIONS_MAX);
  });
});

describe("getEffectiveGaugeSegmentDivisions", () => {
  it("returns 0 when segmented arc is off regardless of stored count", () => {
    expect(getEffectiveGaugeSegmentDivisions(false, 24)).toBe(0);
  });

  it("uses stored count when on", () => {
    expect(getEffectiveGaugeSegmentDivisions(true, 12)).toBe(12);
  });

  it("uses legacy count when on and stored is 0", () => {
    expect(getEffectiveGaugeSegmentDivisions(true, 0)).toBe(LEGACY_GAUGE_SEGMENT_DIVISIONS);
  });
});

describe("effectiveGaugeSegmentDivisionsFromDataAttrs", () => {
  const root = () => document.documentElement;

  beforeEach(() => {
    delete root().dataset.gaugeSegmentEnabled;
    delete root().dataset.gaugeSegmentDivisions;
    delete root().dataset.gaugeSegmentLines;
  });

  it("returns 0 when data-gauge-segment-enabled is 0 even if divisions is stale 20", () => {
    root().dataset.gaugeSegmentEnabled = "0";
    root().dataset.gaugeSegmentDivisions = "20";
    expect(effectiveGaugeSegmentDivisionsFromDataAttrs(root())).toBe(0);
  });

  it("uses divisions when enabled is 1", () => {
    root().dataset.gaugeSegmentEnabled = "1";
    root().dataset.gaugeSegmentDivisions = "12";
    expect(effectiveGaugeSegmentDivisionsFromDataAttrs(root())).toBe(12);
  });

  it("applies same effective rules as getEffective (on + 0 → legacy) when enabled is 1", () => {
    root().dataset.gaugeSegmentEnabled = "1";
    root().dataset.gaugeSegmentDivisions = "0";
    expect(effectiveGaugeSegmentDivisionsFromDataAttrs(root())).toBe(LEGACY_GAUGE_SEGMENT_DIVISIONS);
  });

  it("treats data-gauge-segment-enabled true as on", () => {
    root().dataset.gaugeSegmentEnabled = "true";
    root().dataset.gaugeSegmentDivisions = "8";
    expect(effectiveGaugeSegmentDivisionsFromDataAttrs(root())).toBe(8);
  });

  it("treats data-gauge-segment-enabled false as off even with a division count", () => {
    root().dataset.gaugeSegmentEnabled = "false";
    root().dataset.gaugeSegmentDivisions = "20";
    expect(effectiveGaugeSegmentDivisionsFromDataAttrs(root())).toBe(0);
  });

  it("uses legacy data-gauge-segment-lines when data-gauge-segment-enabled is absent", () => {
    root().dataset.gaugeSegmentLines = "0";
    root().dataset.gaugeSegmentDivisions = "20";
    expect(effectiveGaugeSegmentDivisionsFromDataAttrs(root())).toBe(0);
    root().dataset.gaugeSegmentLines = "1";
    delete root().dataset.gaugeSegmentDivisions;
    expect(effectiveGaugeSegmentDivisionsFromDataAttrs(root())).toBe(LEGACY_GAUGE_SEGMENT_DIVISIONS);
  });

  it("infers enabled from data-gauge-segment-divisions when no enabled flag and no lines", () => {
    root().dataset.gaugeSegmentDivisions = "5";
    expect(effectiveGaugeSegmentDivisionsFromDataAttrs(root())).toBe(5);
    expect(gaugeSegmentEnabledFromDataAttrs(root())).toBe(true);
  });

  it("is off with no data attrs (defaults)", () => {
    expect(effectiveGaugeSegmentDivisionsFromDataAttrs(root())).toBe(0);
  });
});

describe("themeStorage", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.colorPreset;
    delete document.documentElement.dataset.gaugeCapStyle;
    delete document.documentElement.dataset.gaugeSegmentEnabled;
    delete document.documentElement.dataset.gaugeSegmentDivisions;
    delete document.documentElement.dataset.gaugeSegmentLines;
    delete document.documentElement.dataset.gaugeSegmentGap;
    delete document.documentElement.dataset.gaugeSegmentGapPx;
  });

  describe("getEffectiveIsDark", () => {
    it("forces dark and light regardless of prefers", () => {
      expect(getEffectiveIsDark("dark", false)).toBe(true);
      expect(getEffectiveIsDark("dark", true)).toBe(true);
      expect(getEffectiveIsDark("light", false)).toBe(false);
      expect(getEffectiveIsDark("light", true)).toBe(false);
    });

    it("uses prefers for system", () => {
      expect(getEffectiveIsDark("system", false)).toBe(false);
      expect(getEffectiveIsDark("system", true)).toBe(true);
    });
  });

  describe("applyDocumentTheme", () => {
    it("sets dark class, data-color-preset, and gauge data attributes", () => {
      applyDocumentTheme("light", "emerald", false);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.dataset.colorPreset).toBe("emerald");
      expect(document.documentElement.dataset.gaugeCapStyle).toBe("flat");
      expect(document.documentElement.dataset.gaugeSegmentEnabled).toBe("0");
      expect(document.documentElement.dataset.gaugeSegmentDivisions).toBe("0");
      expect(document.documentElement.dataset.gaugeSegmentLines).toBe("0");
      expect(document.documentElement.dataset.gaugeSegmentGap).toBe(String(DEFAULT_GAUGE_SEGMENT_GAP));
      expect(document.documentElement.dataset.gaugeSegmentGapPx).toBeUndefined();

      applyDocumentTheme("light", "emerald", false, "flat", true, 12, DEFAULT_GAUGE_SEGMENT_GAP);
      expect(document.documentElement.dataset.gaugeSegmentEnabled).toBe("1");
      expect(document.documentElement.dataset.gaugeSegmentDivisions).toBe("12");
      expect(document.documentElement.dataset.gaugeSegmentLines).toBe("1");

      applyDocumentTheme("dark", "default", false, "rounded", false, 0, 3.25);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.dataset.colorPreset).toBe("default");
      expect(document.documentElement.dataset.gaugeCapStyle).toBe("rounded");
      expect(document.documentElement.dataset.gaugeSegmentEnabled).toBe("0");
      expect(document.documentElement.dataset.gaugeSegmentDivisions).toBe("0");
      expect(document.documentElement.dataset.gaugeSegmentLines).toBe("0");
      expect(document.documentElement.dataset.gaugeSegmentGap).toBe("0.325");
      expect(document.documentElement.dataset.gaugeSegmentGapPx).toBeUndefined();
    });
  });

  describe("getSystemPrefersDark", () => {
    it("reads matchMedia when available", () => {
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        matches: String(query).includes("dark"),
        media: String(query),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      expect(getSystemPrefersDark()).toBe(true);
    });

    it("returns false when matchMedia is not a function", () => {
      const original = window.matchMedia;
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: undefined,
      });
      expect(getSystemPrefersDark()).toBe(false);
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: original,
      });
    });
  });
});

describe("themeStorage localStorage", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.colorPreset;
    delete document.documentElement.dataset.gaugeCapStyle;
    delete document.documentElement.dataset.gaugeSegmentEnabled;
    delete document.documentElement.dataset.gaugeSegmentDivisions;
    delete document.documentElement.dataset.gaugeSegmentLines;
    delete document.documentElement.dataset.gaugeSegmentGap;
    delete document.documentElement.dataset.gaugeSegmentGapPx;
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns defaults when empty", () => {
    expect(loadThemePreferences()).toEqual({
      version: 1,
      mode: "system",
      colorPreset: "default",
      gaugeCapStyle: "flat",
      gaugeSegmentDivisions: DEFAULT_GAUGE_SEGMENT_DIVISIONS,
      gaugeSegmentEnabled: false,
      gaugeSegmentLines: false,
      gaugeSegmentGapPx: DEFAULT_GAUGE_SEGMENT_GAP,
    });
  });

  it("roundtrips valid JSON", () => {
    saveThemePreferences({ version: 1, mode: "dark", colorPreset: "emerald" });
    expect(loadThemePreferences()).toEqual({
      version: 1,
      mode: "dark",
      colorPreset: "emerald",
      gaugeCapStyle: "flat",
      gaugeSegmentDivisions: DEFAULT_GAUGE_SEGMENT_DIVISIONS,
      gaugeSegmentEnabled: false,
      gaugeSegmentLines: false,
      gaugeSegmentGapPx: DEFAULT_GAUGE_SEGMENT_GAP,
    });
  });

  it("migrates legacy gaugeSegmentLines true without division count", () => {
    store[KEY] = JSON.stringify({
      version: 1,
      mode: "light",
      colorPreset: "default",
      gaugeSegmentLines: true,
    });
    const p = loadThemePreferences();
    expect(p.gaugeSegmentDivisions).toBe(LEGACY_GAUGE_SEGMENT_DIVISIONS);
    expect(p.gaugeSegmentEnabled).toBe(true);
    expect(p.gaugeSegmentLines).toBe(true);
  });

  it("roundtrips gauge cap style flat", () => {
    saveThemePreferences({ version: 1, mode: "light", colorPreset: "default", gaugeCapStyle: "flat" });
    expect(loadThemePreferences().gaugeCapStyle).toBe("flat");
  });

  it("roundtrips gauge cap style rounded", () => {
    saveThemePreferences({ version: 1, mode: "light", colorPreset: "default", gaugeCapStyle: "rounded" });
    expect(loadThemePreferences().gaugeCapStyle).toBe("rounded");
  });

  it("roundtrips gauge segment options (legacy lines off → 0 divisions)", () => {
    saveThemePreferences({
      version: 1,
      mode: "light",
      colorPreset: "default",
      gaugeSegmentLines: false,
      gaugeSegmentGapPx: 4,
    });
    const p = loadThemePreferences();
    expect(p.gaugeSegmentDivisions).toBe(0);
    expect(p.gaugeSegmentEnabled).toBe(false);
    expect(p.gaugeSegmentLines).toBe(false);
    expect(p.gaugeSegmentGapPx).toBe(0.4);
  });

  it("roundtrips gauge segment division count", () => {
    saveThemePreferences({
      version: 1,
      mode: "light",
      colorPreset: "default",
      gaugeSegmentDivisions: 48,
    });
    const p = loadThemePreferences();
    expect(p.gaugeSegmentDivisions).toBe(48);
    expect(p.gaugeSegmentEnabled).toBe(true);
    expect(p.gaugeSegmentLines).toBe(true);
  });

  it("clamps gauge segment gap on load", () => {
    store[KEY] = JSON.stringify({
      version: 1,
      mode: "light",
      colorPreset: "default",
      gaugeSegmentGapPx: 500,
    });
    expect(loadThemePreferences().gaugeSegmentGapPx).toBe(GAUGE_SEGMENT_GAP_MAX);
    store[KEY] = JSON.stringify({
      version: 1,
      mode: "light",
      colorPreset: "default",
      gaugeSegmentGapPx: 0.01,
    });
    expect(loadThemePreferences().gaugeSegmentGapPx).toBe(0.01);
  });

  it("falls back to defaults on invalid JSON", () => {
    store[KEY] = "not-json";
    expect(loadThemePreferences().mode).toBe("system");
  });

  it("falls back to defaults on wrong shape", () => {
    store[KEY] = JSON.stringify({ version: 1, mode: "dim" });
    expect(loadThemePreferences().mode).toBe("system");
  });

  it("resyncDocumentThemeFromStorage applies stored mode with system preference", () => {
    store[KEY] = JSON.stringify({ version: 1, mode: "system", colorPreset: "emerald" });
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: false,
      media: String(query),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    resyncDocumentThemeFromStorage();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.colorPreset).toBe("emerald");
    expect(document.documentElement.dataset.gaugeCapStyle).toBe("flat");
    expect(document.documentElement.dataset.gaugeSegmentEnabled).toBe("0");
    expect(document.documentElement.dataset.gaugeSegmentDivisions).toBe(String(DEFAULT_GAUGE_SEGMENT_DIVISIONS));
    expect(document.documentElement.dataset.gaugeSegmentLines).toBe("0");
    expect(document.documentElement.dataset.gaugeSegmentGap).toBe(String(DEFAULT_GAUGE_SEGMENT_GAP));
    expect(document.documentElement.dataset.gaugeSegmentGapPx).toBeUndefined();
  });
});

describe("themeStorage without localStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loadThemePreferences returns defaults and save is no-op", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", undefined);
    expect(loadThemePreferences()).toEqual({
      version: 1,
      mode: "system",
      colorPreset: "default",
      gaugeCapStyle: "flat",
      gaugeSegmentDivisions: DEFAULT_GAUGE_SEGMENT_DIVISIONS,
      gaugeSegmentEnabled: false,
      gaugeSegmentLines: false,
      gaugeSegmentGapPx: DEFAULT_GAUGE_SEGMENT_GAP,
    });
    expect(() =>
      saveThemePreferences({ version: 1, mode: "light", colorPreset: "default" }),
    ).not.toThrow();
  });
});
