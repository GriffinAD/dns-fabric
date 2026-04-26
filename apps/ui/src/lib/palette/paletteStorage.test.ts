import { afterEach, describe, expect, it, vi } from "vitest";

import {
  capDedupeIds,
  loadPinnedPaletteIds,
  loadRecentPaletteIds,
  recordRecentPaletteId,
  savePinnedPaletteIds,
} from "./paletteStorage";

describe("paletteStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("capDedupeIds preserves order and caps", () => {
    expect(capDedupeIds(["a", "b", "a", "c"], 2)).toEqual(["a", "b"]);
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
