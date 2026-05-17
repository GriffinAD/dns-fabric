import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EditorSettingsModal from "./EditorSettingsModal.svelte";
import { saveDashboardSettings } from "./dashboardSettings";
import { applyDocumentTheme, loadThemePreferences, saveThemePreferences } from "../theme/themeStorage";

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
  saveDashboardSettings({ version: 1, gapPx: 8 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EditorSettingsModal", () => {
  it("opens and commits accent, gauge, and padding changes", () => {
    render(EditorSettingsModal, { props: { open: true } });

    expect(screen.getByTestId("editor-display-settings-modal")).toBeTruthy();

    const accent = document.querySelector("#editor-settings-accent") as HTMLSelectElement;
    fireEvent.change(accent, { target: { value: "gray" } });
    expect(loadThemePreferences().colorPreset).toBe("gray");

    const gauge = screen.getByTestId("header-gauge-arc-segments-toggle") as HTMLInputElement;
    fireEvent.change(gauge, { target: { checked: true } });
    expect(loadThemePreferences().gaugeSegmentEnabled).toBe(true);

    const gap = document.querySelector("#editor-settings-dashboard-gap") as HTMLInputElement;
    fireEvent.change(gap, { target: { value: "12" } });
    fireEvent.blur(gap);

    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    fireEvent.click(closeButtons[closeButtons.length - 1]!);
  });
});
