import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import type { FabricEvent } from "../api/types";
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

  it("unsubscribe stops delivery for that listener", async () => {
    const gw = new DataGateway("");
    const bus = createFabricEventBus(gw);
    const received: number[] = [];
    const unsub = bus.subscribe("fabric.perf.updated", perfUpdatedCpuPercent, (v) => received.push(v));

    let push: (ev: FabricEvent) => void = () => {};
    vi.spyOn(gw, "subscribeFabricEvents").mockImplementation((onEvent) => {
      push = onEvent;
      return () => {};
    });

    bus.connect();
    push({
      topic: "fabric.perf.updated",
      occurred_at: "t",
      payload: { cpu_percent_total: 1 },
    });
    await vi.waitUntil(() => received.length === 1);
    unsub();
    push({
      topic: "fabric.perf.updated",
      occurred_at: "t",
      payload: { cpu_percent_total: 2 },
    });
    expect(received).toEqual([1]);
  });

  it("selector returning null does not call onValue", async () => {
    const gw = new DataGateway("");
    const bus = createFabricEventBus(gw);
    const received: string[] = [];
    bus.subscribe("fabric.perf.updated", () => null, () => received.push("x"));

    let push: (ev: FabricEvent) => void = () => {};
    vi.spyOn(gw, "subscribeFabricEvents").mockImplementation((onEvent) => {
      push = onEvent;
      return () => {};
    });

    bus.connect();
    push({
      topic: "fabric.perf.updated",
      occurred_at: "t",
      payload: { cpu_percent_total: 9 },
    });
    expect(received).toEqual([]);
  });

  it("sets connectionState error when gateway signals failure", async () => {
    const gw = new DataGateway("");
    const bus = createFabricEventBus(gw);
    vi.spyOn(gw, "subscribeFabricEvents").mockImplementation((_onOk, onErr) => {
      queueMicrotask(() => onErr?.("event source error"));
      return () => {};
    });
    bus.connect();
    await vi.waitUntil(() => get(bus.connectionState) === "error");
  });

  it("can reconnect after teardown (idle → open)", async () => {
    const gw = new DataGateway("");
    const bus = createFabricEventBus(gw);
    let push: (ev: FabricEvent) => void = () => {};
    vi.spyOn(gw, "subscribeFabricEvents").mockImplementation((onEvent) => {
      push = onEvent;
      return () => {};
    });
    const stop = bus.connect();
    push({
      topic: "fabric.perf.updated",
      occurred_at: "t",
      payload: { cpu_percent_total: 0 },
    });
    await vi.waitUntil(() => get(bus.connectionState) === "open");
    stop();
    expect(get(bus.connectionState)).toBe("idle");
    const stop2 = bus.connect();
    push({
      topic: "fabric.perf.updated",
      occurred_at: "t",
      payload: { cpu_percent_total: 1 },
    });
    await vi.waitUntil(() => get(bus.connectionState) === "open");
    expect(stop2).not.toBe(stop);
    stop2();
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
