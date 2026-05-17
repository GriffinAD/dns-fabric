import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import type { FabricEvent } from "../api/types";
import { DataGateway } from "../dataGateway";
import { perfSummaryForTick } from "../../mock/perfSimulate";
import {
  createFabricEventBus,
  dhcpClientsListUpdated,
  dhcpPoolsListUpdated,
  dhcpReservationsListUpdated,
  discoveryScanUpdated,
  perfUpdatedCpuPercent,
  perfUpdatedFullSummary,
} from "./eventBus";

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

describe("perfUpdatedFullSummary", () => {
  it("returns null for non-object payloads", () => {
    expect(perfUpdatedFullSummary(null)).toBeNull();
    expect(perfUpdatedFullSummary("nope")).toBeNull();
  });

  it("strips tick and parses a full mock snapshot", () => {
    const snap = perfSummaryForTick(2);
    const parsed = perfUpdatedFullSummary({ ...snap, tick: 2 });
    expect(parsed).not.toBeNull();
    expect(parsed!.cpu_percent_total).toBe(snap.cpu_percent_total);
    expect(parsed!.collected_at).toBe(snap.collected_at);
  });

  it("returns null when shape is invalid", () => {
    expect(perfUpdatedFullSummary({ tick: 1, cpu_percent_total: 1 })).toBeNull();
  });
});

describe("discoveryScanUpdated", () => {
  it("parses scan snapshots", () => {
    expect(
      discoveryScanUpdated({ state: "running", updated_at: "2026-01-01T00:00:00Z" }),
    ).toEqual({ state: "running", updated_at: "2026-01-01T00:00:00Z" });
    expect(discoveryScanUpdated({ state: "nope", updated_at: "t" })).toBeNull();
  });
});

describe("dhcp list selectors", () => {
  it("parse list payloads and reject revision-only signals", () => {
    expect(dhcpPoolsListUpdated({ items: [] })).toEqual([]);
    expect(dhcpPoolsListUpdated({ revision: 1 })).toBeNull();
    expect(dhcpClientsListUpdated({ items: [] })).toEqual([]);
    expect(dhcpClientsListUpdated({ revision: 1 })).toBeNull();
    expect(dhcpReservationsListUpdated({ items: [] })).toEqual([]);
    expect(dhcpReservationsListUpdated({ revision: 1 })).toBeNull();
  });
});
