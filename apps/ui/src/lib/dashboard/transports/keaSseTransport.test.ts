import { describe, expect, it } from "vitest";

import { createFabricEventBus } from "../eventBus";
import { DataGateway } from "../../dataGateway";
import { attachKeaSseTransport } from "./keaSseTransport";

describe("attachKeaSseTransport", () => {
  it("returns a no-op release (Kea SSE is wired by FabricEventBus.connect)", () => {
    const gateway = new DataGateway("");
    const bus = createFabricEventBus(gateway);
    const release = attachKeaSseTransport(bus, gateway);
    expect(typeof release).toBe("function");
    release();
  });
});
