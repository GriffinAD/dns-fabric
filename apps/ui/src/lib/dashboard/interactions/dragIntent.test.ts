import { describe, expect, it } from "vitest";

import { DASHBOARD_DRAG_INTENT_KINDS, type DashboardDragIntent } from "./dragIntent";

describe("dragIntent types", () => {
  it("exports intent kind list", () => {
    expect(DASHBOARD_DRAG_INTENT_KINDS.length).toBe(4);
  });

  it("accepts palette plugin intent", () => {
    const intent: DashboardDragIntent = { kind: "palette-plugin", pluginId: "dhcp.pools" };
    expect(intent.pluginId).toBe("dhcp.pools");
  });
});
