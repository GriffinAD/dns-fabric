import { describe, expect, it } from "vitest";

import { handlePerfTileGridHint } from "./gridHints";
import type { DashboardLayoutV2 } from "./types";

describe("handlePerfTileGridHint", () => {
  it("applies larger colSpan from hint for perf.cpu", () => {
    const items: DashboardLayoutV2["items"] = [
      {
        kind: "tile",
        id: "t1",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      },
    ];
    let saved: DashboardLayoutV2 | null = null;
    handlePerfTileGridHint(items, "t1", { colSpan: 4, rowSpan: 2 }, (next) => {
      saved = next as DashboardLayoutV2;
    });
    expect(saved).not.toBeNull();
    const t0 = saved!.items[0];
    expect(t0 && "grid" in t0 && t0.grid?.colSpan).toBe(4);
    expect(t0 && "grid" in t0 && t0.grid?.rowSpan).toBe(2);
  });

  it("no-ops when tile id missing", () => {
    let calls = 0;
    handlePerfTileGridHint([], "missing", { colSpan: 6, rowSpan: 1 }, () => {
      calls += 1;
    });
    expect(calls).toBe(0);
  });

  it("perf.ram only expands colSpan", () => {
    const items: DashboardLayoutV2["items"] = [
      {
        kind: "tile",
        id: "t1",
        pluginId: "perf.ram",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
      },
    ];
    let saved: DashboardLayoutV2 | null = null;
    handlePerfTileGridHint(items, "t1", { colSpan: 1, rowSpan: 1 }, (next) => {
      saved = next as DashboardLayoutV2;
    });
    expect(saved).toBeNull();
  });

  it("perf.ram expands when hint requests larger colSpan", () => {
    const items: DashboardLayoutV2["items"] = [
      {
        kind: "tile",
        id: "t1",
        pluginId: "perf.ram",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
      },
    ];
    let saved: DashboardLayoutV2 | null = null;
    handlePerfTileGridHint(items, "t1", { colSpan: 6, rowSpan: 1 }, (next) => {
      saved = next as DashboardLayoutV2;
    });
    expect(saved).not.toBeNull();
    const t1 = saved!.items[0];
    expect(t1 && "grid" in t1 && t1.grid?.colSpan).toBe(6);
  });

  it("uses tileColSpan when tile has no grid and applies origin 0,0", () => {
    const items: DashboardLayoutV2["items"] = [
      {
        kind: "tile",
        id: "t1",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ];
    let saved: DashboardLayoutV2 | null = null;
    handlePerfTileGridHint(items, "t1", { colSpan: 3, rowSpan: 2 }, (next) => {
      saved = next as DashboardLayoutV2;
    });
    expect(saved).not.toBeNull();
    const t0 = saved!.items[0];
    expect(t0 && "grid" in t0 && t0.grid).toMatchObject({ col: 0, row: 0, colSpan: 3, rowSpan: 2 });
  });

  it("non-ram shrinks to 1 col when hint colSpan is 1", () => {
    const items: DashboardLayoutV2["items"] = [
      {
        kind: "tile",
        id: "t1",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
      },
    ];
    let saved: DashboardLayoutV2 | null = null;
    handlePerfTileGridHint(items, "t1", { colSpan: 1, rowSpan: 1 }, (next) => {
      saved = next as DashboardLayoutV2;
    });
    expect(saved).not.toBeNull();
    const t2 = saved!.items[0];
    expect(t2 && "grid" in t2 && t2.grid?.colSpan).toBe(1);
  });
});
