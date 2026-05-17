import { describe, expect, it } from "vitest";

import type { BaseDataTableColumn } from "./baseDataTable";
import { columnStableId, mergeBaseDataTableSettings, defaultBaseDataTableSettings } from "./baseDataTable";

describe("baseDataTable helpers", () => {
  it("mergeBaseDataTableSettings skips nullish patches", () => {
    const a = mergeBaseDataTableSettings(
      defaultBaseDataTableSettings,
      {
        allowSort: false,
        pageSize: 25,
        rowHeightMode: "compact",
        defaultSortColumnId: "name",
        defaultSortDirection: "desc",
        interactionMode: "inline",
      },
      undefined,
      null,
      { allowFilter: false },
    );
    expect(a.allowSort).toBe(false);
    expect(a.allowFilter).toBe(false);
    expect(a.pageSize).toBe(25);
    expect(a.rowHeightMode).toBe("compact");
    expect(a.defaultSortColumnId).toBe("name");
    expect(a.defaultSortDirection).toBe("desc");
    expect(a.interactionMode).toBe("inline");
    expect(a.allowModal).toBe(defaultBaseDataTableSettings.allowModal);
  });

  it("normalizes legacy inline-expanded interaction mode", () => {
    const a = mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
      interactionMode: "inline-expanded",
    });
    expect(a.interactionMode).toBe("inline");
  });

  it("columnStableId prefers id over header", () => {
    const col: BaseDataTableColumn = { id: "x", header: "Y", accessor: () => "" };
    expect(columnStableId(col)).toBe("x");
    expect(columnStableId({ header: "Only", accessor: () => "" })).toBe("Only");
  });
});
