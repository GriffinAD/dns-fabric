import { describe, expect, it } from "vitest";

import { DataGateway } from "../../dataGateway";
import { resolvePluginTileMount } from "./dashboardTileRegistry";

describe("dashboardTileRegistry", () => {
  it("re-exports resolvePluginTileMount", () => {
    const gateway = new DataGateway("");
    const m = resolvePluginTileMount({
      gateway,
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
