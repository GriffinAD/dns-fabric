import { afterEach, describe, expect, it, vi } from "vitest";

import {
  capDedupeIds,
  loadPaletteDockMode,
  loadPinnedPaletteIds,
  loadRecentPaletteIds,
  normalizePaletteDockMode,
  recordRecentPaletteId,
  savePaletteDockMode,
  savePinnedPaletteIds,
} from "./paletteStorage";

describe("paletteStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("capDedupeIds preserves order and caps", () => {
    expect(capDedupeIds(["a", "b", "a", "c"], 2)).toEqual(["a", "b"]);
  });

  it("normalizePaletteDockMode falls back to float", () => {
    expect(normalizePaletteDockMode("inline")).toBe("inline");
    expect(normalizePaletteDockMode(" sticky ")).toBe("sticky");
    expect(normalizePaletteDockMode(null)).toBe("float");
  });

  it("persists palette dock mode in localStorage", () => {
    const mem: Record<string, string> = {};
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
    expect(loadPaletteDockMode()).toBe("float");
    savePaletteDockMode("sticky");
    expect(loadPaletteDockMode()).toBe("sticky");
  });

  it("loadPaletteDockMode falls back when getItem throws", () => {
    vi.stubGlobal(
      "localStorage",
      {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        get length() {
          return 0;
        },
      } as Storage,
    );
    expect(loadPaletteDockMode()).toBe("float");
  });

  it("loadPaletteDockMode parses non-JSON raw via normalize", () => {
    const mem: Record<string, string> = {
      "kea-fabric-palette-dock": "inline",
    };
    vi.stubGlobal(
      "localStorage",
      {
        getItem: (k: string) => (k in mem ? mem[k]! : null),
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        get length() {
          return 1;
        },
      } as Storage,
    );
    expect(loadPaletteDockMode()).toBe("inline");
  });

  it("savePaletteDockMode ignores setItem errors", () => {
    vi.stubGlobal(
      "localStorage",
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        get length() {
          return 0;
        },
      } as Storage,
    );
    expect(() => savePaletteDockMode("float")).not.toThrow();
  });

  it("ignores write errors from localStorage", () => {
    vi.stubGlobal(
      "localStorage",
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        get length() {
          return 0;
        },
      } as Storage,
    );
    expect(() => savePinnedPaletteIds(["a"])).not.toThrow();
  });

  it("persists pinned and recent in localStorage", () => {
    const mem: Record<string, string> = {};
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
    savePinnedPaletteIds(["p1", "p2"]);
    expect(loadPinnedPaletteIds()).toEqual(["p1", "p2"]);
    recordRecentPaletteId("a");
    recordRecentPaletteId("b");
    recordRecentPaletteId("a");
    expect(loadRecentPaletteIds()[0]).toBe("a");
  });
});
