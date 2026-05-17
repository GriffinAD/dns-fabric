import { getContext } from "svelte";

import type { DataGateway } from "../dataGateway";
import { createFabricEventBus, FABRIC_EVENT_BUS, type FabricEventBus } from "./eventBus";

export type FabricBusKernel = {
  bus: FabricEventBus;
  /** Tear down transports + SSE connection. */
  dispose: () => void;
};

export type FabricBusKernelOptions = {
  gateway: DataGateway;
  /** Register CP/control-plane transports (Pi-hole bundle). */
  registerCpTransports?: (bus: FabricEventBus, gateway: DataGateway) => () => void;
};

export function attachFabricBusKernel(opts: FabricBusKernelOptions): FabricBusKernel {
  const bus = createFabricEventBus(opts.gateway);
  const releases: Array<() => void> = [];
  releases.push(bus.connect());
  if (opts.registerCpTransports) {
    releases.push(opts.registerCpTransports(bus, opts.gateway));
  }
  return {
    bus,
    dispose: () => {
      for (const r of releases) r();
    },
  };
}

/** Dashboard mounts must run under a shell that called `attachFabricBusKernel` + `setContext`. */
export function requireFabricEventBusContext(): FabricEventBus {
  const bus = getContext<FabricEventBus | undefined>(FABRIC_EVENT_BUS);
  if (!bus) {
    throw new Error(
      "FabricEventBus context is required. Call attachFabricBusKernel at the app shell and setContext(FABRIC_EVENT_BUS, kernel.bus).",
    );
  }
  return bus;
}
