import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyDocumentTheme,
  getEffectiveIsDark,
  getSystemPrefersDark,
  loadThemePreferences,
  resyncDocumentThemeFromStorage,
  saveThemePreferences,
} from "./themeStorage";

const KEY = "kea-fabric-ui-theme";

describe("themeStorage", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.colorPreset;
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
    it("sets dark class and data-color-preset", () => {
      applyDocumentTheme("light", "emerald", false);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.dataset.colorPreset).toBe("emerald");

      applyDocumentTheme("dark", "default", false);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.dataset.colorPreset).toBe("default");
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
    });
  });

  it("roundtrips valid JSON", () => {
    saveThemePreferences({ version: 1, mode: "dark", colorPreset: "emerald" });
    expect(loadThemePreferences()).toEqual({
      version: 1,
      mode: "dark",
      colorPreset: "emerald",
    });
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
    });
    expect(() =>
      saveThemePreferences({ version: 1, mode: "light", colorPreset: "default" }),
    ).not.toThrow();
  });
});
