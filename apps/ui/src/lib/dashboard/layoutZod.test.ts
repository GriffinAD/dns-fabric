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
});
