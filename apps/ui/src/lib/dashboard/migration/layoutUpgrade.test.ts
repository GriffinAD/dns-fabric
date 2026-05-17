import { describe, expect, it } from "vitest";

import {
  dedupeLayoutV3ItemIds,
  ensureLayoutV3,
  layoutGraphHasDuplicateIds,
  layoutNestedGroupDepthExceeded,
  tabGroupWrapperId,
  wrapLegacyTabControlTile,
} from "./layoutUpgrade";
import type { DashboardLayout, DashboardLayoutV3, RootLayoutItem } from "../types";

describe("layoutUpgrade v3", () => {
  it("ensureLayoutV3 dedupes duplicate root tile ids", () => {
    const dup: DashboardLayoutV3 = {
      version: 3,
      items: [
        {
          kind: "tile",
          id: "same",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "full",
        },
        {
          kind: "tile",
          id: "same",
          pluginId: "perf.ram",
          hostControl: "single-panel",
          displayMode: "full",
        },
      ],
    };
    const out = ensureLayoutV3(dup);
    expect(out.items.length).toBe(1);
  });

  it("layoutGraphHasDuplicateIds detects duplicates nested two levels deep", () => {
    expect(
      layoutGraphHasDuplicateIds([
        {
          kind: "group",
          id: "g",
          showBorder: true,
          children: [
            {
              kind: "group",
              id: "inner",
              showBorder: true,
              children: [
                {
                  id: "x",
                  pluginId: "perf.cpu",
                  hostControl: "single-panel",
                  displayMode: "full",
                },
                {
                  id: "x",
                  pluginId: "perf.ram",
                  hostControl: "single-panel",
                  displayMode: "full",
                },
              ],
            },
          ],
        },
      ]),
    ).toBe(true);
  });

  it("layoutGraphHasDuplicateIds detects duplicates inside a group", () => {
    expect(
      layoutGraphHasDuplicateIds([
        {
          kind: "group",
          id: "g",
          showBorder: true,
          children: [
            {
              id: "d",
              pluginId: "perf.cpu",
              hostControl: "single-panel",
              displayMode: "full",
            },
            {
              id: "d",
              pluginId: "perf.ram",
              hostControl: "single-panel",
              displayMode: "full",
            },
          ],
        },
      ]),
    ).toBe(true);
  });

  it("layoutNestedGroupDepthExceeded is true when nesting exceeds max", () => {
    const leaf = {
      id: "leaf",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
    };
    let node: object = leaf;
    for (let i = 0; i < 9; i++) {
      node = { kind: "group", id: `g${i}`, children: [node] };
    }
    expect(layoutNestedGroupDepthExceeded([node as never])).toBe(true);
  });

  it("ensureLayoutV3 dedupes after v2 migration when graph still has duplicate ids", () => {
    const corrupt: DashboardLayout = {
      version: 2,
      items: [
        {
          kind: "tile",
          id: "shared",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "full",
        },
        {
          kind: "group",
          id: "g",
          showBorder: true,
          children: [
            {
              id: "shared",
              pluginId: "perf.ram",
              hostControl: "single-panel",
              displayMode: "full",
            },
          ],
        },
      ],
    };
    const out = ensureLayoutV3(corrupt);
    expect(out.version).toBe(3);
    expect(out.items.length).toBeLessThanOrEqual(2);
  });

  it("dedupeLayoutV3ItemIds dedupes nested group children", () => {
    const items: RootLayoutItem[] = [
      {
        kind: "group",
        id: "g",
        showBorder: true,
        children: [
          {
            id: "d",
            pluginId: "perf.cpu",
            hostControl: "single-panel",
            displayMode: "full",
          },
          {
            id: "d",
            pluginId: "perf.ram",
            hostControl: "single-panel",
            displayMode: "full",
          },
        ],
      },
    ];
    const out = dedupeLayoutV3ItemIds({ version: 3, items });
    const g = out.items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind === "group") expect(g.children.length).toBe(1);
  });

  it("dedupeLayoutV3ItemIds recurses into nested groups when deduping children", () => {
    const items: RootLayoutItem[] = [
      {
        kind: "group",
        id: "g",
        showBorder: true,
        children: [
          {
            id: "a",
            pluginId: "perf.cpu",
            hostControl: "single-panel",
            displayMode: "full",
          },
          {
            kind: "group",
            id: "inner",
            showBorder: true,
            children: [
              {
                id: "d",
                pluginId: "perf.ram",
                hostControl: "single-panel",
                displayMode: "full",
              },
              {
                id: "d",
                pluginId: "perf.network",
                hostControl: "single-panel",
                displayMode: "compact",
              },
            ],
          },
        ],
      },
    ];
    const out = dedupeLayoutV3ItemIds({ version: 3, items });
    const g = out.items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind === "group") {
      const inner = g.children[1];
      expect(inner && "kind" in inner && inner.kind === "group").toBe(true);
      if (inner && "kind" in inner && inner.kind === "group") {
        expect(inner.children.length).toBe(1);
      }
    }
  });

  it("wrapLegacyTabControlTile produces tab group with single-panel child", () => {
    const wrapped = wrapLegacyTabControlTile({
      id: "legacy-tab",
      pluginId: "perf.cpu",
      hostControl: "tab-control",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
    });
    expect(wrapped).toMatchObject({
      kind: "group",
      id: tabGroupWrapperId("legacy-tab"),
      hostControl: "tab-control",
      hostState: { activeChildId: "legacy-tab" },
      grid: { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
      children: [
        {
          id: "legacy-tab",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          tabLabel: "perf.cpu",
          displayMode: "full",
          grid: { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
        },
      ],
    });
  });

  it("ensureLayoutV3 wraps legacy root tile tab-control into tab group", () => {
    const out = ensureLayoutV3({
      version: 3,
      items: [
        {
          kind: "tile",
          id: "legacy-tab",
          pluginId: "perf.cpu",
          hostControl: "tab-control",
          displayMode: "full",
          grid: { col: 0, row: 0, colSpan: 8, rowSpan: 1 },
        },
      ],
    });
    expect(out.items).toHaveLength(1);
    const g = out.items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind === "group") {
      expect(g.id).toBe(tabGroupWrapperId("legacy-tab"));
      expect(g.hostControl).toBe("tab-control");
      expect(g.hostState?.activeChildId).toBe("legacy-tab");
      expect(g.children[0]).toMatchObject({
        id: "legacy-tab",
        hostControl: "single-panel",
        pluginId: "perf.cpu",
      });
    }
  });

  it("ensureLayoutV3 migrates legacy tab-control inside nested group children", () => {
    const out = ensureLayoutV3({
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
                  id: "deep-tab",
                  pluginId: "perf.cpu",
                  hostControl: "tab-control",
                  displayMode: "full",
                },
              ],
            },
          ],
        },
      ],
    });
    const outer = out.items[0];
    expect(outer?.kind).toBe("group");
    if (outer?.kind === "group") {
      const inner = outer.children[0];
      expect(inner && "kind" in inner && inner.kind === "group").toBe(true);
      if (inner && "kind" in inner && inner.kind === "group") {
        const tabWrap = inner.children[0];
        expect(tabWrap && "kind" in tabWrap && tabWrap.kind === "group").toBe(true);
        if (tabWrap && "kind" in tabWrap && tabWrap.kind === "group") {
          expect(tabWrap.hostControl).toBe("tab-control");
          expect(tabWrap.children[0]).toMatchObject({ id: "deep-tab", hostControl: "single-panel" });
        }
      }
    }
  });

  it("ensureLayoutV3 wraps legacy tab-control tile inside a group", () => {
    const out = ensureLayoutV3({
      version: 3,
      items: [
        {
          kind: "group",
          id: "outer",
          showBorder: true,
          children: [
            {
              id: "inner-tab",
              pluginId: "dhcp.pools",
              hostControl: "tab-control",
              displayMode: "compact",
            },
          ],
        },
      ],
    });
    const outer = out.items[0];
    expect(outer?.kind).toBe("group");
    if (outer?.kind === "group") {
      const child = outer.children[0];
      expect(child && "kind" in child && child.kind === "group").toBe(true);
      if (child && "kind" in child && child.kind === "group") {
        expect(child.hostControl).toBe("tab-control");
        expect(child.children[0]).toMatchObject({ id: "inner-tab", hostControl: "single-panel" });
      }
    }
  });

  it("dedupeLayoutV3ItemIds maps tile leaves without recursing as groups", () => {
    const items: RootLayoutItem[] = [
      {
        kind: "group",
        id: "g",
        showBorder: true,
        children: [
          {
            id: "a",
            pluginId: "perf.cpu",
            hostControl: "single-panel",
            displayMode: "full",
          },
          {
            id: "b",
            pluginId: "perf.ram",
            hostControl: "single-panel",
            displayMode: "full",
          },
        ],
      },
    ];
    const out = dedupeLayoutV3ItemIds({ version: 3, items });
    const g = out.items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind === "group") expect(g.children.length).toBe(2);
  });
});
