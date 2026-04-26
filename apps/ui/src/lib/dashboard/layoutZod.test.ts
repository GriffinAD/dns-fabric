import { describe, expect, it } from "vitest";

import { MAX_DASHBOARD_GROUP_DEPTH } from "./types";
import { parseDashboardLayoutZod } from "./layoutZod";

describe("parseDashboardLayoutZod", () => {
  it("rejects group child grid that breaks root wrap rule when innerWrap is on", () => {
    expect(
      parseDashboardLayoutZod({
        version: 2,
        items: [
          {
            kind: "group",
            id: "g",
            innerWrap: true,
            children: [
              {
                id: "a",
                pluginId: "perf.cpu",
                hostControl: "single-panel",
                displayMode: "compact",
                grid: { col: 19, row: 0, colSpan: 2, rowSpan: 1 },
              },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects group outer grid that is not a complete root placement", () => {
    expect(
      parseDashboardLayoutZod({
        version: 2,
        items: [
          {
            kind: "group",
            id: "g",
            grid: { col: 14, row: 0, colSpan: 7, rowSpan: 1 },
            children: [],
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects non-perf tile options that are not an empty object", () => {
    expect(
      parseDashboardLayoutZod({
        version: 2,
        items: [
          {
            kind: "tile",
            id: "a",
            pluginId: "dhcp.pools",
            hostControl: "single-panel",
            displayMode: "full",
            options: { cpu_total: true },
          },
        ],
      }),
    ).toBeNull();
  });

  it("accepts perf tile with perf options", () => {
    const parsed = parseDashboardLayoutZod({
      version: 2,
      items: [
        {
          id: "a",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "compact",
          options: { cpu_total: true, display_style: "gauge" },
        },
      ],
    });
    expect(parsed?.version).toBe(2);
  });

  it("accepts v3 with nested groups and normalizes showBorder", () => {
    const parsed = parseDashboardLayoutZod({
      version: 3,
      items: [
        {
          kind: "group",
          id: "outer",
          grid: { col: 0, row: 0, colSpan: 20, rowSpan: 3 },
          children: [
            {
              kind: "group",
              id: "inner",
              grid: { col: 0, row: 0, colSpan: 10, rowSpan: 2 },
              children: [
                {
                  id: "t",
                  pluginId: "dhcp.pools",
                  hostControl: "single-panel",
                  displayMode: "full",
                  grid: { col: 0, row: 0, colSpan: 10, rowSpan: 1 },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(parsed?.version).toBe(3);
    if (parsed?.version === 3) {
      const outer = parsed.items[0];
      expect(outer?.kind).toBe("group");
      if (outer?.kind === "group") {
        expect(outer.showBorder).toBe(true);
        const inner = outer.children[0];
        expect(inner && "kind" in inner && inner.kind === "group").toBe(true);
      }
    }
  });

  it("rejects v3 when nested group depth exceeds max", () => {
    const leaf = {
      id: "leaf",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
    };
    let node: object = leaf;
    for (let i = 0; i < MAX_DASHBOARD_GROUP_DEPTH + 1; i++) {
      node = { kind: "group", id: `g${i}`, children: [node] };
    }
    expect(parseDashboardLayoutZod({ version: 3, items: [node as never] })).toBeNull();
  });

  it("rejects v3 innerWrap group that contains a nested group", () => {
    expect(
      parseDashboardLayoutZod({
        version: 3,
        items: [
          {
            kind: "group",
            id: "g",
            innerWrap: true,
            grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 },
            children: [
              {
                kind: "group",
                id: "nested",
                grid: { col: 0, row: 0, colSpan: 10, rowSpan: 1 },
                children: [
                  {
                    id: "t",
                    pluginId: "perf.cpu",
                    hostControl: "single-panel",
                    displayMode: "full",
                    grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects v3 nowrap parent when nested group child grid is invalid for strip rules", () => {
    expect(
      parseDashboardLayoutZod({
        version: 3,
        items: [
          {
            kind: "group",
            id: "outer",
            innerWrap: false,
            grid: { col: 0, row: 0, colSpan: 20, rowSpan: 2 },
            children: [
              {
                kind: "group",
                id: "inner",
                grid: { col: 0, row: 0, colSpan: 0, rowSpan: 1 },
                children: [
                  {
                    id: "t",
                    pluginId: "perf.cpu",
                    hostControl: "single-panel",
                    displayMode: "full",
                    grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects v3 when duplicate ids appear in the graph", () => {
    expect(
      parseDashboardLayoutZod({
        version: 3,
        items: [
          {
            id: "dup",
            pluginId: "perf.cpu",
            hostControl: "single-panel",
            displayMode: "full",
          },
          {
            id: "dup",
            pluginId: "perf.ram",
            hostControl: "single-panel",
            displayMode: "full",
          },
        ],
      }),
    ).toBeNull();
  });
});
