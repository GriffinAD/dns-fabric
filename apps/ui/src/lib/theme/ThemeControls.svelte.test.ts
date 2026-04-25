import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ThemeControls from "./ThemeControls.svelte";
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

describe("ThemeControls", () => {
  it("hides accent select when showAccent is false", () => {
    render(ThemeControls, { props: { showAccent: false } });
    expect(screen.queryByLabelText("Accent")).toBeNull();
    expect(screen.getByTestId("theme-appearance-toggle")).toBeTruthy();
  });

  it("toggles appearance mode and commits accent", () => {
    render(ThemeControls, { props: { showAccent: true } });
    const appearanceToggle = screen.getByTestId("theme-appearance-toggle");
    fireEvent.click(appearanceToggle); // light -> dark
    expect(loadThemePreferences().mode).toBe("dark");
    fireEvent.click(appearanceToggle); // dark -> light
    expect(loadThemePreferences().mode).toBe("light");

    const accent = document.querySelector("#theme-accent") as HTMLSelectElement;
    fireEvent.change(accent, { target: { value: "gray" } });
    expect(loadThemePreferences().colorPreset).toBe("gray");
  });

  it("toggles gauge arc segments when header control is shown", () => {
    render(ThemeControls, { props: { showGaugeSegmentToggle: true, showAccent: false } });
    const toggle = screen.getByTestId("header-gauge-arc-segments-toggle");
    fireEvent.change(toggle, { target: { checked: true } });
    expect(loadThemePreferences().gaugeSegmentEnabled).toBe(true);
  });
});
