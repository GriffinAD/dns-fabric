import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import { DataGateway } from "../dataGateway";
import { createFabricEventBus, perfUpdatedCpuPercent } from "./eventBus";

describe("createFabricEventBus", () => {
  it("returns the same disconnect when connect is called twice", () => {
    const gw = new DataGateway("");
    const bus = createFabricEventBus(gw);
    vi.spyOn(gw, "subscribeFabricEvents").mockReturnValue(() => {});
    const a = bus.connect();
    const b = bus.connect();
    expect(a).toBe(b);
    a();
  });

  it("fans out SSE events by topic to subscribers", async () => {
    const gw = new DataGateway("");
    const bus = createFabricEventBus(gw);
    const received: number[] = [];
    const unsub = bus.subscribe("fabric.perf.updated", perfUpdatedCpuPercent, (v) => received.push(v));

    vi.spyOn(gw, "subscribeFabricEvents").mockImplementation((onEvent) => {
      queueMicrotask(() => {
        onEvent({
          topic: "fabric.perf.updated",
          occurred_at: "t",
          payload: { cpu_percent_total: 12 },
        });
      });
      return () => {};
    });

    const stop = bus.connect();
    await vi.waitUntil(() => received.length > 0);
    expect(received[0]).toBe(12);
    expect(get(bus.connectionState)).toBe("open");
    unsub();
    stop();
  });
});

describe("perfUpdatedCpuPercent", () => {
  it("returns null for invalid payloads", () => {
    expect(perfUpdatedCpuPercent(null)).toBeNull();
    expect(perfUpdatedCpuPercent({})).toBeNull();
    expect(perfUpdatedCpuPercent({ cpu_percent_total: "nope" })).toBeNull();
  });

  it("returns finite numbers", () => {
    expect(perfUpdatedCpuPercent({ cpu_percent_total: 3.5 })).toBe(3.5);
  });
});
