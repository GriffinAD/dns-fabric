import { describe, expect, it, vi } from "vitest";

import * as gridPlacement from "./gridPlacement";
import { layoutWithGrid } from "./gridPlacement";
import { normalizeLayoutStrict } from "./layoutNormalize";
import type { DashboardLayoutV2 } from "./types";

describe("normalizeLayoutStrict", () => {
  it("returns v2 layout when structure is valid", () => {
    const input: DashboardLayoutV2 = {
      version: 2,
      items: [
        {
          kind: "tile",
          id: "t1",
          pluginId: "dhcp.pools",
          hostControl: "single-panel",
          displayMode: "full",
        },
      ],
    };
    const direct = layoutWithGrid(input, { editMode: false });
    const via = normalizeLayoutStrict(input, false);
    expect(via.version).toBe(2);
    expect(via.items.length).toBe(direct.items.length);
  });

  it("passes preserveRootPlacementIfComplete to layoutWithGrid", () => {
    const spy = vi.spyOn(gridPlacement, "layoutWithGrid");
    const input: DashboardLayoutV2 = {
      version: 2,
      items: [
        {
          kind: "tile",
          id: "t1",
          pluginId: "dhcp.pools",
          hostControl: "single-panel",
          displayMode: "full",
          grid: { col: 0, row: 0, colSpan: 6, rowSpan: 1 },
        },
      ],
    };
    normalizeLayoutStrict(input, false, { preserveRootPlacementIfComplete: true });
    expect(spy).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ preserveRootPlacementIfComplete: true, editMode: false }),
    );
    spy.mockRestore();
  });

  it("throws when normalized layout is not v2", () => {
    vi.spyOn(gridPlacement, "layoutWithGrid").mockReturnValueOnce({ version: 1, tiles: [] } as never);
    expect(() => normalizeLayoutStrict({ version: 2, items: [] }, false)).toThrow("invalid structure");
    vi.restoreAllMocks();
  });
});
