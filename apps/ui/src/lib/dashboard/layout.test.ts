import { describe, expect, it } from "vitest";

import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";
import { iterateTilesInLayout } from "./layoutTree";
import { isLayoutV2, type RootTileItem } from "./types";

describe("DEFAULT_DASHBOARD_LAYOUT", () => {
  it("is v2 with a status group and root tiles", () => {
    expect(DEFAULT_DASHBOARD_LAYOUT.version).toBe(2);
    expect(isLayoutV2(DEFAULT_DASHBOARD_LAYOUT)).toBe(true);
    const g = DEFAULT_DASHBOARD_LAYOUT.items.find((i) => i.kind === "group");
    expect(g?.kind).toBe("group");
    expect((g as { children: unknown[] }).children.length).toBe(4);
    for (const t of iterateTilesInLayout(DEFAULT_DASHBOARD_LAYOUT.items)) {
      expect(t.id).toBeTruthy();
      expect(t.pluginId).toBeTruthy();
      expect(t.hostControl).toBeTruthy();
      expect(t.displayMode).toMatch(/compact|full/);
    }
    const ram = g && g.kind === "group" ? g.children.find((t) => t.pluginId === "perf.ram") : undefined;
    expect(ram?.rowPanel).toBeUndefined();
    expect(ram?.options?.display_style).toBe("gauge");
    expect(ram?.grid?.colSpan).toBe(4);
    const root = DEFAULT_DASHBOARD_LAYOUT.items.filter((i): i is RootTileItem => i.kind === "tile");
    const clients = root.find((t) => t.pluginId === "dhcp.clients");
    expect(clients?.grid?.colSpan).toBe(5);
    const reservations = root.find((t) => t.pluginId === "dhcp.reservations");
    expect(reservations?.grid?.colSpan).toBe(20);
  });
});
