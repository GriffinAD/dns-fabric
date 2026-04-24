import { describe, expect, it } from "vitest";

import { parseDashboardLayoutZod } from "./layoutZod";

describe("parseDashboardLayoutZod", () => {
  it("rejects group child grid that breaks 12-col rule when innerWrap is on", () => {
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
                grid: { col: 14, row: 0, colSpan: 2, rowSpan: 1 },
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
            grid: { col: 6, row: 0, colSpan: 7, rowSpan: 1 },
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
});
