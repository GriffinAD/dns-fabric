import { describe, expect, it } from "vitest";

import { buildPaginationTokens, clampPage, slotsForDensity } from "./basePagination";

describe("basePagination helpers", () => {
  it("maps slot density to fixed slot counts", () => {
    expect(slotsForDensity("compact")).toBe(5);
    expect(slotsForDensity("default")).toBe(7);
    expect(slotsForDensity("expanded")).toBe(9);
  });

  it("builds all page tokens when total pages fit in slots", () => {
    const tokens = buildPaginationTokens(5, 3, 7);
    expect(tokens).toEqual([
      { kind: "page", page: 1 },
      { kind: "page", page: 2 },
      { kind: "page", page: 3 },
      { kind: "page", page: 4 },
      { kind: "page", page: 5 },
    ]);
  });

  it("keeps first/last visible and uses ellipsis in compact mode", () => {
    const tokens = buildPaginationTokens(42, 8, 5);
    expect(tokens).toEqual([
      { kind: "page", page: 1 },
      { kind: "ellipsis", id: "left" },
      { kind: "page", page: 8 },
      { kind: "ellipsis", id: "right" },
      { kind: "page", page: 42 },
    ]);
  });

  it("keeps a centered window in default mode", () => {
    const tokens = buildPaginationTokens(42, 8, 7);
    expect(tokens).toEqual([
      { kind: "page", page: 1 },
      { kind: "ellipsis", id: "left" },
      { kind: "page", page: 7 },
      { kind: "page", page: 8 },
      { kind: "page", page: 9 },
      { kind: "ellipsis", id: "right" },
      { kind: "page", page: 42 },
    ]);
  });

  it("pins to trailing edge window near the last page", () => {
    const tokens = buildPaginationTokens(42, 41, 7);
    expect(tokens).toEqual([
      { kind: "page", page: 1 },
      { kind: "ellipsis", id: "left" },
      { kind: "page", page: 38 },
      { kind: "page", page: 39 },
      { kind: "page", page: 40 },
      { kind: "page", page: 41 },
      { kind: "page", page: 42 },
    ]);
  });

  it("clamps requested page numbers into valid range", () => {
    expect(clampPage(-10, 42)).toBe(1);
    expect(clampPage(99, 42)).toBe(42);
    expect(clampPage(7, 42)).toBe(7);
    expect(clampPage(3, 0)).toBe(1);
  });
});
