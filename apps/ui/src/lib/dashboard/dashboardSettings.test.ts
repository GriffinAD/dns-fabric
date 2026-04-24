import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyDocumentDashboardSettings,
  clampGapPx,
  DASHBOARD_GAP_MAX_PX,
  DASHBOARD_GAP_MIN_PX,
  loadDashboardSettings,
  saveDashboardSettings,
} from "./dashboardSettings";

const KEY = "kea-fabric-dashboard-settings";

describe("dashboardSettings", () => {
  describe("clampGapPx", () => {
    it("clamps into the valid range", () => {
      expect(clampGapPx(-5)).toBe(DASHBOARD_GAP_MIN_PX);
      expect(clampGapPx(DASHBOARD_GAP_MAX_PX + 99)).toBe(DASHBOARD_GAP_MAX_PX);
    });

    it("rounds floats to ints", () => {
      expect(clampGapPx(2.6)).toBe(3);
      expect(clampGapPx(2.4)).toBe(2);
    });

    it("returns default gap (8px) for non-finite values", () => {
      expect(clampGapPx(Number.NaN)).toBe(8);
      expect(clampGapPx(Number.POSITIVE_INFINITY)).toBe(8);
      expect(clampGapPx(Number.NEGATIVE_INFINITY)).toBe(8);
    });
  });

  describe("applyDocumentDashboardSettings", () => {
    beforeEach(() => {
      document.documentElement.style.removeProperty("--dashboard-gap");
    });

    it("sets the --dashboard-gap CSS variable in px", () => {
      applyDocumentDashboardSettings({ version: 1, gapPx: 4 });
      expect(document.documentElement.style.getPropertyValue("--dashboard-gap")).toBe("4px");

      applyDocumentDashboardSettings({ version: 1, gapPx: 0 });
      expect(document.documentElement.style.getPropertyValue("--dashboard-gap")).toBe("0px");
    });

    it("no-ops when document is undefined (SSR)", () => {
      const prev = globalThis.document;
      Object.defineProperty(globalThis, "document", { value: undefined, configurable: true });
      try {
        expect(() => applyDocumentDashboardSettings({ version: 1, gapPx: 4 })).not.toThrow();
      } finally {
        Object.defineProperty(globalThis, "document", { value: prev, configurable: true });
      }
    });
  });
});

describe("dashboardSettings localStorage", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
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
  });

  it("returns defaults when empty", () => {
    expect(loadDashboardSettings()).toEqual({ version: 1, gapPx: 8 });
  });

  it("roundtrips a valid value", () => {
    saveDashboardSettings({ version: 1, gapPx: 4 });
    expect(loadDashboardSettings()).toEqual({ version: 1, gapPx: 4 });
  });

  it("falls back to defaults on invalid JSON", () => {
    store[KEY] = "nope";
    expect(loadDashboardSettings().gapPx).toBe(8);
  });

  it("falls back to defaults when gapPx is out of range", () => {
    store[KEY] = JSON.stringify({ version: 1, gapPx: 999 });
    expect(loadDashboardSettings().gapPx).toBe(8);
  });

  it("falls back to defaults when gapPx is not an integer", () => {
    store[KEY] = JSON.stringify({ version: 1, gapPx: 1.5 });
    expect(loadDashboardSettings().gapPx).toBe(8);
  });
});

describe("dashboardSettings without localStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("load returns defaults and save is a no-op", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadDashboardSettings()).toEqual({ version: 1, gapPx: 8 });
    expect(() => saveDashboardSettings({ version: 1, gapPx: 4 })).not.toThrow();
  });
});
