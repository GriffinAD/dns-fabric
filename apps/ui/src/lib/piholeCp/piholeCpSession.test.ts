import { describe, expect, it } from "vitest";

import { createPiholeCpSession } from "./piholeCpSession";

describe("createPiholeCpSession", () => {
  it("returns shared controlPlane and dashboard gateways", () => {
    const s = createPiholeCpSession("http://cp.test");
    expect(s.controlPlane).toBeDefined();
    expect(s.dashboardGateway).toBeDefined();
    expect(s.controlPlane).not.toBe(s.dashboardGateway);
    expect(s.baseUrl).toBe("http://cp.test");
  });
});
