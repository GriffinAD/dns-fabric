import { describe, expect, it, vi } from "vitest";

import * as layoutNormalize from "./layoutNormalize";
import { importDashboardLayoutFromJson } from "./layoutImport";

describe("importDashboardLayoutFromJson", () => {
  it("returns error for invalid JSON", () => {
    const r = importDashboardLayoutFromJson("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("File is not valid JSON.");
  });

  it("returns error when layout fails validation", () => {
    const r = importDashboardLayoutFromJson(JSON.stringify({ version: 99, items: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe(
        "Layout failed validation (version, grid, or plugin options).",
      );
    }
  });

  it("returns error when normalization throws", () => {
    const spy = vi.spyOn(layoutNormalize, "normalizeLayoutStrict").mockImplementation(() => {
      throw new Error("bad normalize");
    });
    const body = JSON.stringify({
      version: 3,
      items: [
        {
          kind: "tile",
          id: "a",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "full",
          grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
        },
      ],
    });
    const r = importDashboardLayoutFromJson(body);
    spy.mockRestore();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("bad normalize");
  });

  it("stringifies non-Error normalization failures", () => {
    const spy = vi.spyOn(layoutNormalize, "normalizeLayoutStrict").mockImplementation(() => {
      throw "string fail";
    });
    const body = JSON.stringify({
      version: 3,
      items: [
        {
          kind: "tile",
          id: "a",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "full",
          grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
        },
      ],
    });
    const r = importDashboardLayoutFromJson(body);
    spy.mockRestore();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("string fail");
  });

  it("returns v3 layout when valid", () => {
    const body = JSON.stringify({
      version: 3,
      items: [
        {
          kind: "tile",
          id: "a",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "full",
          grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
        },
      ],
    });
    const r = importDashboardLayoutFromJson(body);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.layout.version).toBe(3);
  });
});
