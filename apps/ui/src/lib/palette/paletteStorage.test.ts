import { afterEach, describe, expect, it, vi } from "vitest";

import {
  capDedupeIds,
  clampPaletteFloatPosition,
  defaultPaletteFloatPosition,
  loadPaletteDockMode,
  loadPaletteFloatPosition,
  loadPinnedPaletteIds,
  loadRecentPaletteIds,
  normalizePaletteDockMode,
  recordRecentPaletteId,
  savePaletteDockMode,
  savePaletteFloatPosition,
  savePinnedPaletteIds,
} from "./paletteStorage";

describe("paletteStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("capDedupeIds preserves order and caps", () => {
    expect(capDedupeIds(["a", "b", "a", "c"], 2)).toEqual(["a", "b"]);
    expect(capDedupeIds(["a", "b", "c"], 1)).toEqual(["a"]);
  });

  it("capDedupeIds skips duplicate ids without counting them toward the cap", () => {
    expect(capDedupeIds(["a", "a", "b"], 2)).toEqual(["a", "b"]);
  });

  it("normalizePaletteDockMode falls back to float", () => {
    expect(normalizePaletteDockMode("inline")).toBe("inline");
    expect(normalizePaletteDockMode(" sticky ")).toBe("sticky");
    expect(normalizePaletteDockMode("  unknown  ")).toBe("float");
    expect(normalizePaletteDockMode(null)).toBe("float");
  });

  it("clampPaletteFloatPosition keeps the panel inside the viewport", () => {
    expect(clampPaletteFloatPosition(-100, -50, 200, 100, 800, 600)).toEqual({ left: 8, top: 8 });
    expect(clampPaletteFloatPosition(10_000, 10_000, 200, 100, 800, 600)).toEqual({ left: 592, top: 492 });
  });

  it("defaultPaletteFloatPosition anchors top-right", () => {
    const p = defaultPaletteFloatPosition(1000, 800);
    expect(p.left).toBeGreaterThan(400);
    expect(p.top).toBeGreaterThanOrEqual(8);
  });

  it("persists and clears floating palette position", () => {
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
    savePaletteFloatPosition({ left: 12, top: 34 });
    expect(loadPaletteFloatPosition()).toEqual({ left: 12, top: 34 });
    savePaletteFloatPosition(null);
    expect(loadPaletteFloatPosition()).toBeNull();
  });

  it("loadPaletteFloatPosition returns null on invalid stored JSON", () => {
    const mem: Record<string, string> = {
      "kea-fabric-palette-float-pos": "not-json{",
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
    expect(loadPaletteFloatPosition()).toBeNull();
  });

  it("loadPaletteFloatPosition returns null when parsed JSON is not an object", () => {
    const mem: Record<string, string> = {
      "kea-fabric-palette-float-pos": "4",
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
    expect(loadPaletteFloatPosition()).toBeNull();
  });

  it("loadPaletteFloatPosition returns null when left/top are not finite", () => {
    const mem: Record<string, string> = {
      "kea-fabric-palette-float-pos": JSON.stringify({ left: "x", top: 1 }),
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
    expect(loadPaletteFloatPosition()).toBeNull();
  });

  it("savePaletteFloatPosition no-ops when localStorage is undefined", () => {
    vi.stubGlobal("localStorage", undefined as unknown as Storage);
    expect(() => savePaletteFloatPosition({ left: 1, top: 2 })).not.toThrow();
    expect(() => savePaletteFloatPosition(null)).not.toThrow();
  });

  it("savePaletteFloatPosition ignores setItem errors", () => {
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
    expect(() => savePaletteFloatPosition({ left: 1, top: 2 })).not.toThrow();
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

  it("returns empty pinned/recent when localStorage is undefined", () => {
    vi.stubGlobal("localStorage", undefined as unknown as Storage);
    expect(loadPinnedPaletteIds()).toEqual([]);
    expect(loadRecentPaletteIds()).toEqual([]);
    expect(loadPaletteFloatPosition()).toBeNull();
    expect(loadPaletteDockMode()).toBe("float");
  });

  it("filters pinned JSON to non-empty strings under 300 chars", () => {
    const mem: Record<string, string> = {
      "kea-fabric-palette-pinned": JSON.stringify(["ok", "", 1, "x".repeat(400), null]),
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
    expect(loadPinnedPaletteIds()).toEqual(["ok"]);
  });

  it("returns empty pinned list when stored JSON is not an array", () => {
    const mem: Record<string, string> = {
      "kea-fabric-palette-pinned": "{}",
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
    expect(loadPinnedPaletteIds()).toEqual([]);
  });

  it("savePaletteDockMode no-ops when localStorage is undefined", () => {
    vi.stubGlobal("localStorage", undefined as unknown as Storage);
    expect(() => savePaletteDockMode("sticky")).not.toThrow();
  });

  it("recordRecentPaletteId no-ops writes when localStorage is undefined", () => {
    vi.stubGlobal("localStorage", undefined as unknown as Storage);
    expect(() => recordRecentPaletteId("p1")).not.toThrow();
  });

  it("returns empty pinned list when stored JSON is invalid", () => {
    const mem: Record<string, string> = {
      "kea-fabric-palette-pinned": "not-json[",
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
    expect(loadPinnedPaletteIds()).toEqual([]);
  });

  it("returns empty pinned list when getItem throws", () => {
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
    expect(loadPinnedPaletteIds()).toEqual([]);
  });
});
