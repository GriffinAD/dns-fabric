import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPaletteDisplaySettings,
  reloadPaletteDisplaySettingsFromStorage,
  resetPaletteDisplaySettings,
  setPaletteDropShadow,
  setPaletteTransparency,
} from "./paletteDisplaySettings";

describe("paletteDisplaySettings", () => {
  const mem: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal(
      "localStorage",
      {
        getItem: (k: string) => (k in mem ? mem[k]! : null),
        setItem: (k: string, v: string) => {
          mem[k] = v;
        },
        removeItem: (k: string) => {
          delete mem[k];
        },
        clear: () => {
          for (const x of Object.keys(mem)) delete mem[x];
        },
        key: () => null,
        get length() {
          return Object.keys(mem).length;
        },
      } as Storage,
    );
    resetPaletteDisplaySettings();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const x of Object.keys(mem)) delete mem[x];
  });

  it("defaults transparency and dropShadow to true", () => {
    expect(getPaletteDisplaySettings()).toEqual({ transparency: true, dropShadow: true });
  });

  it("treats empty string stored value like missing (defaults)", () => {
    mem["kea-fabric-palette-display"] = "";
    reloadPaletteDisplaySettingsFromStorage();
    expect(getPaletteDisplaySettings()).toEqual({ transparency: true, dropShadow: true });
  });

  it("persists transparency and dropShadow to localStorage", () => {
    setPaletteTransparency(false);
    setPaletteDropShadow(false);
    expect(mem["kea-fabric-palette-display"]).toBe(
      JSON.stringify({ transparency: false, dropShadow: false }),
    );
    expect(getPaletteDisplaySettings()).toEqual({ transparency: false, dropShadow: false });
  });

  it("partial updates preserve the other flag", () => {
    setPaletteTransparency(false);
    expect(getPaletteDisplaySettings()).toEqual({ transparency: false, dropShadow: true });
    setPaletteDropShadow(false);
    expect(getPaletteDisplaySettings()).toEqual({ transparency: false, dropShadow: false });
  });

  it("uses defaults when stored JSON is invalid", () => {
    mem["kea-fabric-palette-display"] = "not-json";
    reloadPaletteDisplaySettingsFromStorage();
    expect(getPaletteDisplaySettings()).toEqual({ transparency: true, dropShadow: true });
  });

  it("defaults non-boolean fields when parsing stored object", () => {
    mem["kea-fabric-palette-display"] = JSON.stringify({ transparency: false, dropShadow: "yes" });
    reloadPaletteDisplaySettingsFromStorage();
    expect(getPaletteDisplaySettings()).toEqual({ transparency: false, dropShadow: true });
  });

  it("defaults transparency when not a boolean while keeping boolean dropShadow", () => {
    mem["kea-fabric-palette-display"] = JSON.stringify({ transparency: 1, dropShadow: false });
    reloadPaletteDisplaySettingsFromStorage();
    expect(getPaletteDisplaySettings()).toEqual({ transparency: true, dropShadow: false });
  });

  it("defaults when JSON root is null", () => {
    mem["kea-fabric-palette-display"] = "null";
    reloadPaletteDisplaySettingsFromStorage();
    expect(getPaletteDisplaySettings()).toEqual({ transparency: true, dropShadow: true });
  });

  it("defaults when JSON root is not an object", () => {
    mem["kea-fabric-palette-display"] = "4";
    reloadPaletteDisplaySettingsFromStorage();
    expect(getPaletteDisplaySettings()).toEqual({ transparency: true, dropShadow: true });
  });

  it("ignores localStorage setItem failures when persisting", () => {
    vi.stubGlobal(
      "localStorage",
      {
        getItem: (k: string) => (k in mem ? mem[k]! : null),
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: (k: string) => {
          delete mem[k];
        },
        clear: () => {
          for (const x of Object.keys(mem)) delete mem[x];
        },
        key: () => null,
        get length() {
          return Object.keys(mem).length;
        },
      } as Storage,
    );
    setPaletteTransparency(false);
    expect(getPaletteDisplaySettings().transparency).toBe(false);
  });
});
