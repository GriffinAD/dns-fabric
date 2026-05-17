import { describe, expect, it } from "vitest";

import { createFabricEventBus } from "../../dashboard/eventBus";
import { DataGateway } from "../../gateway/dataGateway";
import { resolvePluginTileMount } from "./dashboardTileRegistry";

describe("dashboardTileRegistry", () => {
  it("re-exports resolvePluginTileMount", () => {
    const gateway = new DataGateway("");
    const bus = createFabricEventBus(gateway);
    const m = resolvePluginTileMount({
      gateway,
      bus,
      tile: {
        id: "t",
        pluginId: "dhcp.pools",
        hostControl: "single-panel",
        displayMode: "full",
      },
      editLayout: false,
    });
    expect(m).not.toBeNull();
  });
});
