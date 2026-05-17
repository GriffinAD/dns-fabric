import { describe, expect, it, vi } from "vitest";

import type { DashboardResponse } from "./dashboardZod";
import { isDashboardMetaCoherent, sleep } from "./piholeCpPostApplyWait";

const dashBase: DashboardResponse = {
  node: "pi2",
  version: "1",
  widgets: [],
  sections: { ha: { dhcp_mode: "none" } },
};

describe("isDashboardMetaCoherent", () => {
  it("returns true when Kea is off and no Kea widgets", () => {
    expect(
      isDashboardMetaCoherent({ node: "pi2", peer_ui_base_url: null, kea_fabric_api_base_url: null, dhcp_mode: "none" }, dashBase),
    ).toBe(true);
  });

  it("sleep resolves after the requested delay", async () => {
    vi.useFakeTimers();
    const done = sleep(25);
    await vi.advanceTimersByTimeAsync(25);
    await expect(done).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("returns false when meta says Kea off but dashboard still lists kea_dhcp widget", () => {
    expect(
      isDashboardMetaCoherent(
        { node: "pi2", peer_ui_base_url: null, kea_fabric_api_base_url: null, dhcp_mode: "none" },
        {
          ...dashBase,
          widgets: [{ id: "w1", title: "DHCP", section: "kea_dhcp" }],
        },
      ),
    ).toBe(false);
  });
});
