import { describe, expect, it } from "vitest";

import { E2E_TAB_GROUP_V3_LAYOUT } from "../../../../tests/e2e/fixtures/editorGridFixture";
import { stripLegacyPerfSummaryTiles } from "./stripLegacyPerfSummary";
import type { DashboardLayoutV2, DashboardLayoutV3 } from "../types";

describe("stripLegacyPerfSummaryTiles", () => {
  it("drops a group whose children are only legacy perf.summary tiles", () => {
    const layout: DashboardLayoutV2 = {
      version: 2,
      items: [
        {
          kind: "group",
          id: "g",
          showBorder: true,
          children: [
            {
              id: "l",
              pluginId: "perf.summary",
              hostControl: "single-panel",
              displayMode: "full",
            },
          ],
        },
      ],
    };
    const out = stripLegacyPerfSummaryTiles(layout);
    expect(out.version).toBe(3);
    expect(out.items.length).toBe(0);
  });

  it("drops a nested group when stripping leaves it empty", () => {
    const layout = {
      version: 3,
      items: [
        {
          kind: "group",
          id: "outer",
          showBorder: true,
          children: [
            {
              kind: "group",
              id: "inner",
              showBorder: true,
              children: [
                {
                  id: "l",
                  pluginId: "perf.summary",
                  hostControl: "single-panel",
                  displayMode: "full",
                },
              ],
            },
          ],
        },
      ],
    } as unknown as DashboardLayoutV3;
    const out = stripLegacyPerfSummaryTiles(layout);
    expect(out.version).toBe(3);
    expect(out.items.length).toBe(0);
  });

  it("keeps empty tab pane groups (tabLabel) inside tab-control hosts", () => {
    const out = stripLegacyPerfSummaryTiles(E2E_TAB_GROUP_V3_LAYOUT);
    expect(out.items.some((i) => i.kind === "group" && i.id === "tabs-e2e")).toBe(true);
  });

  it("keeps nested group when stripping removes only legacy tiles inside it", () => {
    const layout = {
      version: 3,
      items: [
        {
          kind: "group",
          id: "outer",
          showBorder: true,
          children: [
            {
              kind: "group",
              id: "inner",
              showBorder: true,
              children: [
                {
                  id: "l",
                  pluginId: "perf.summary",
                  hostControl: "single-panel",
                  displayMode: "full",
                },
                {
                  id: "c",
                  pluginId: "perf.cpu",
                  hostControl: "single-panel",
                  displayMode: "full",
                },
              ],
            },
          ],
        },
      ],
    } as unknown as DashboardLayoutV3;
    const out = stripLegacyPerfSummaryTiles(layout);
    expect(out.items.length).toBe(1);
    const outer = out.items[0];
    expect(outer?.kind).toBe("group");
    if (outer?.kind === "group") {
      expect(outer.children.length).toBe(1);
      const inner = outer.children[0];
      expect(inner && "kind" in inner && inner.kind === "group").toBe(true);
      if (inner && "kind" in inner && inner.kind === "group") {
        expect(inner.children.length).toBe(1);
        expect(inner.children[0]?.id).toBe("c");
      }
    }
  });
});
