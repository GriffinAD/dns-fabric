import { describe, expect, it, vi } from "vitest";

import { DataGateway } from "../../gateway/dataGateway";
import { flushLayoutToServer, postLayoutSaveFileSnapshot } from "./remoteLayout";

describe("remoteLayout", () => {
  it("flushLayoutToServer delegates to gateway.putDashboardLayout", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const gateway = { putDashboardLayout: put } as unknown as DataGateway;
    await flushLayoutToServer(gateway, "default", { version: 3, items: [] });
    expect(put).toHaveBeenCalledWith("default", { version: 3, items: [] });
  });

  it("postLayoutSaveFileSnapshot delegates to gateway.postDashboardLayoutSaveFile", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const gateway = { postDashboardLayoutSaveFile: post } as unknown as DataGateway;
    await postLayoutSaveFileSnapshot(gateway, "x", { version: 3, items: [] });
    expect(post).toHaveBeenCalledWith("x", { version: 3, items: [] });
  });
});
