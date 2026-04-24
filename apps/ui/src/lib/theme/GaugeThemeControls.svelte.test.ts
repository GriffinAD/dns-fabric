import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GaugeThemeControls from "./GaugeThemeControls.svelte";
import { applyDocumentTheme, loadThemePreferences, saveThemePreferences } from "./themeStorage";

let lsStore: Record<string, string>;

beforeEach(() => {
  lsStore = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) =>
      Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k]! : null,
    setItem: (k: string, v: string) => {
      lsStore[k] = v;
    },
    removeItem: (k: string) => {
      delete lsStore[k];
    },
    clear: () => {
      lsStore = {};
    },
  });
  saveThemePreferences({
    version: 1,
    mode: "light",
    colorPreset: "default",
    gaugeCapStyle: "flat",
    gaugeSegmentEnabled: false,
    gaugeSegmentDivisions: 0,
    gaugeSegmentGapPx: 0.15,
  });
  applyDocumentTheme("light", "default", false, "flat", false, 0, 0.15);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GaugeThemeControls", () => {
  it("renders gauge controls", () => {
    render(GaugeThemeControls);
    expect(screen.getByTestId("gauge-theme-controls")).toBeTruthy();
    expect(screen.getByLabelText("Gauge end caps")).toBeTruthy();
  });

  it("commits cap style and segment ranges", () => {
    render(GaugeThemeControls);
    const cap = document.querySelector("#admin-gauge-caps") as HTMLSelectElement;
    fireEvent.change(cap, { target: { value: "rounded" } });
    expect(loadThemePreferences().gaugeCapStyle).toBe("rounded");

    const divisions = document.querySelector(
      "#admin-gauge-segment-divisions",
    ) as HTMLInputElement;
    fireEvent.input(divisions, { target: { value: "12" } });
    fireEvent.change(divisions);
    expect(loadThemePreferences().gaugeSegmentDivisions).toBe(12);

    const gap = document.querySelector("#admin-gauge-segment-gap") as HTMLInputElement;
    fireEvent.input(gap, { target: { value: "0.42" } });
    fireEvent.change(gap);
    expect(loadThemePreferences().gaugeSegmentGapPx).toBeCloseTo(0.42, 5);
  });

  it("toggles segment arc from admin checkbox", () => {
    render(GaugeThemeControls);
    const toggle = screen.getByTestId("gauge-arc-segments-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.change(toggle, { target: { checked: true } });
    expect(loadThemePreferences().gaugeSegmentEnabled).toBe(true);
  });
});
