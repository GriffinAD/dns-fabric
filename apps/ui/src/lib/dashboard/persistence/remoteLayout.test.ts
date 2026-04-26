import { describe, expect, it, vi } from "vitest";

import { DataGateway } from "../../dataGateway";
import { flushLayoutToServer, postLayoutSaveFileSnapshot } from "./remoteLayout";

describe("remoteLayout", () => {
  it("flushLayoutToServer delegates to gateway.putDashboardLayout", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const gateway = { putDashboardLayout: put } as unknown as DataGateway;
    await flushLayoutToServer(gateway, "default", { version: 2, items: [] });
    expect(put).toHaveBeenCalledWith("default", { version: 2, items: [] });
  });

  it("postLayoutSaveFileSnapshot delegates to gateway.postDashboardLayoutSaveFile", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const gateway = { postDashboardLayoutSaveFile: post } as unknown as DataGateway;
    await postLayoutSaveFileSnapshot(gateway, "x", { version: 2, items: [] });
    expect(post).toHaveBeenCalledWith("x", { version: 2, items: [] });
  });
});
