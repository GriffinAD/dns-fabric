import { describe, expect, it } from "vitest";

import { stripLegacyPerfSummaryTiles } from "./stripLegacyPerfSummary";
import type { DashboardLayoutV2 } from "../types";

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
});
