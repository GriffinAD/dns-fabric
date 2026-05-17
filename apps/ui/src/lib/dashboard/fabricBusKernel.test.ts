import { describe, expect, it, vi } from "vitest";
import { mount, unmount } from "svelte";

import { DataGateway } from "../dataGateway";
import { attachFabricBusKernel } from "./fabricBusKernel";
import FabricBusContextHost from "./fabricBusContextHost.test.svelte";
import FabricBusRequireProbe from "./fabricBusRequireProbe.test.svelte";

describe("attachFabricBusKernel", () => {
  it("creates a bus, connects SSE, and disposes on teardown", () => {
    const gateway = new DataGateway("");
    const connectSpy = vi.spyOn(gateway, "subscribeFabricEvents").mockReturnValue(() => {});

    const kernel = attachFabricBusKernel({ gateway });
    expect(kernel.bus).toBeDefined();
    expect(connectSpy).toHaveBeenCalledOnce();

    kernel.dispose();
    expect(connectSpy).toHaveBeenCalledOnce();
  });

  it("registers optional CP transports and disposes them with the kernel", () => {
    const gateway = new DataGateway("");
    vi.spyOn(gateway, "subscribeFabricEvents").mockReturnValue(() => {});
    const cpStop = vi.fn();
    const registerCpTransports = vi.fn(() => cpStop);

    const kernel = attachFabricBusKernel({ gateway, registerCpTransports });
    expect(registerCpTransports).toHaveBeenCalledWith(kernel.bus, gateway);

    kernel.dispose();
    expect(cpStop).toHaveBeenCalledOnce();
  });

  it("exposes subscribe, connect, and emit on the kernel bus", () => {
    const gateway = new DataGateway("");
    vi.spyOn(gateway, "subscribeFabricEvents").mockReturnValue(() => {});
    const kernel = attachFabricBusKernel({ gateway });
    expect(typeof kernel.bus.subscribe).toBe("function");
    expect(typeof kernel.bus.connect).toBe("function");
    expect(typeof kernel.bus.emit).toBe("function");
    kernel.dispose();
  });
});

describe("requireFabricEventBusContext", () => {
  it("throws when FABRIC_EVENT_BUS context is missing", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(() => {
      mount(FabricBusRequireProbe, { target: el });
    }).toThrow(/FabricEventBus context is required/);
    el.remove();
  });

  it("returns the bus when context is set", () => {
    const gateway = new DataGateway("");
    vi.spyOn(gateway, "subscribeFabricEvents").mockReturnValue(() => {});
    const kernel = attachFabricBusKernel({ gateway });
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = mount(FabricBusContextHost, { target: el, props: { bus: kernel.bus } });
    expect(el.querySelector('[data-testid="fabric-bus-context-ok"]')?.getAttribute("data-same")).toBe(
      "yes",
    );
    unmount(app);
    kernel.dispose();
    el.remove();
  });
});
