import { describe, expect, it } from "vitest";

import {
  attachCpFabricTransport,
  PIHOLE_CP_PERF_SAMPLE_MS,
  startPiholeCpPerfPolling,
} from "./piholeCpPerfPoll";

describe("piholeCpPerfPoll re-exports", () => {
  it("re-exports cpFabricTransport symbols", () => {
    expect(typeof startPiholeCpPerfPolling).toBe("function");
    expect(typeof attachCpFabricTransport).toBe("function");
    expect(PIHOLE_CP_PERF_SAMPLE_MS).toBeGreaterThan(0);
  });
});
