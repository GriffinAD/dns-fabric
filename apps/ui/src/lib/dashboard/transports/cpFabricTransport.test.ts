import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import { createFabricEventBus, perfUpdatedFullSummary } from "../eventBus";
import type { PerfSummaryResponse } from "../../api/types";
import { PiholeCpDashboardGateway } from "../../piholeCp/gateway/PiholeCpDashboardGateway";
import { attachCpFabricTransport, startPiholeCpPerfPolling } from "./cpFabricTransport";

function snap(cpu: number, disk = 50): PerfSummaryResponse {
  return {
    cpu_percent_total: cpu,
    cpu_core_percent: [cpu],
    memory_used_percent: 40,
    memory_used_bytes: 100,
    memory_total_bytes: 1000,
    network_in_mbps: 1,
    network_out_mbps: 2,
    disk_used_percent: disk,
    disk_volumes: [{ label: "/", used_percent: disk }],
    collected_at: new Date().toISOString(),
  };
}

describe("cpFabricTransport", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("attachCpFabricTransport delegates to startPiholeCpPerfPolling", async () => {
    vi.useFakeTimers();
    const gw = new PiholeCpDashboardGateway("");
    vi.spyOn(gw, "getPerfSummary").mockResolvedValue(snap(10));

    const bus = createFabricEventBus(gw);
    const received: PerfSummaryResponse[] = [];
    bus.subscribe("fabric.perf.updated", perfUpdatedFullSummary, (v) => received.push(v));

    const stop = attachCpFabricTransport(bus, gw, { sampleMs: 1000, uiAverageSamples: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(received).toHaveLength(1);
    expect(get(bus.connectionState)).toBe("open");
    stop();
    expect(get(bus.connectionState)).toBe("idle");
  });

  it("emits first sample immediately then averaged every 3 samples", async () => {
    vi.useFakeTimers();
    const gw = new PiholeCpDashboardGateway("");
    vi.spyOn(gw, "getPerfSummary")
      .mockResolvedValueOnce(snap(10, 50))
      .mockResolvedValueOnce(snap(20, 60))
      .mockResolvedValueOnce(snap(30, 70))
      .mockResolvedValueOnce(snap(40, 80));

    const bus = createFabricEventBus(gw);
    const received: PerfSummaryResponse[] = [];
    bus.subscribe("fabric.perf.updated", perfUpdatedFullSummary, (v) => received.push(v));

    const stop = startPiholeCpPerfPolling(gw, bus, {
      sampleMs: 1000,
      uiAverageSamples: 3,
      diskRefreshMs: 60_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(received).toHaveLength(1);
    expect(received[0]?.cpu_percent_total).toBe(10);
    expect(received[0]?.disk_used_percent).toBe(50);

    await vi.advanceTimersByTimeAsync(1000);
    expect(received).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(received).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(received).toHaveLength(2);
    expect(received[1]?.cpu_percent_total).toBe(30);
    expect(received[1]?.disk_used_percent).toBe(50);

    stop();
  });

  it("refreshes disk on emit only after diskRefreshMs", async () => {
    vi.useFakeTimers();
    const gw = new PiholeCpDashboardGateway("");
    let disk = 50;
    vi.spyOn(gw, "getPerfSummary").mockImplementation(async () => snap(10, disk));

    const bus = createFabricEventBus(gw);
    const received: PerfSummaryResponse[] = [];
    bus.subscribe("fabric.perf.updated", perfUpdatedFullSummary, (v) => received.push(v));

    const stop = startPiholeCpPerfPolling(gw, bus, {
      sampleMs: 1000,
      uiAverageSamples: 3,
      diskRefreshMs: 10_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    disk = 90;
    await vi.advanceTimersByTimeAsync(3000);
    expect(received[1]?.disk_used_percent).toBe(50);

    disk = 99;
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(received.at(-1)?.disk_used_percent).toBe(99);

    stop();
  });

  it("skips a scheduled tick that starts after stop is called", async () => {
    vi.useFakeTimers();
    const gw = new PiholeCpDashboardGateway("");
    const getPerf = vi.spyOn(gw, "getPerfSummary").mockResolvedValue(snap(10));
    let intervalCb: (() => void) | undefined;
    const intervalSpy = vi.spyOn(globalThis, "setInterval").mockImplementation((fn) => {
      intervalCb = fn as () => void;
      return 1 as unknown as ReturnType<typeof setInterval>;
    });

    const bus = createFabricEventBus(gw);
    const stop = startPiholeCpPerfPolling(gw, bus, { sampleMs: 1000, uiAverageSamples: 3 });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    intervalCb?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(getPerf).toHaveBeenCalledOnce();
    intervalSpy.mockRestore();
  });

  it("does not poll after stop", async () => {
    vi.useFakeTimers();
    const gw = new PiholeCpDashboardGateway("");
    const getPerf = vi.spyOn(gw, "getPerfSummary").mockResolvedValue(snap(10));

    const bus = createFabricEventBus(gw);
    const received: PerfSummaryResponse[] = [];
    bus.subscribe("fabric.perf.updated", perfUpdatedFullSummary, (v) => received.push(v));

    const stop = startPiholeCpPerfPolling(gw, bus, { sampleMs: 1000, uiAverageSamples: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(received).toHaveLength(1);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(received).toHaveLength(1);
    expect(getPerf).toHaveBeenCalledOnce();
  });

  it("attachCpFabricTransport stays connecting until first successful sample", async () => {
    vi.useFakeTimers();
    const gw = new PiholeCpDashboardGateway("");
    vi.spyOn(gw, "getPerfSummary").mockRejectedValue(new Error("down"));

    const bus = createFabricEventBus(gw);
    const stop = attachCpFabricTransport(bus, gw, { sampleMs: 1000 });
    expect(get(bus.connectionState)).toBe("connecting");
    await vi.advanceTimersByTimeAsync(0);
    expect(get(bus.connectionState)).toBe("connecting");
    stop();
    expect(get(bus.connectionState)).toBe("idle");
  });

  it("calls onFirstEmit after the first successful sample", async () => {
    vi.useFakeTimers();
    const gw = new PiholeCpDashboardGateway("");
    vi.spyOn(gw, "getPerfSummary").mockResolvedValue(snap(10));
    const onFirstEmit = vi.fn();

    const bus = createFabricEventBus(gw);
    const stop = startPiholeCpPerfPolling(gw, bus, { sampleMs: 1000, onFirstEmit });
    await vi.advanceTimersByTimeAsync(0);
    expect(onFirstEmit).toHaveBeenCalledOnce();
    stop();
  });

  it("ignores getPerfSummary errors and keeps polling", async () => {
    vi.useFakeTimers();
    const gw = new PiholeCpDashboardGateway("");
    vi.spyOn(gw, "getPerfSummary")
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(snap(10));

    const bus = createFabricEventBus(gw);
    const received: PerfSummaryResponse[] = [];
    bus.subscribe("fabric.perf.updated", perfUpdatedFullSummary, (v) => received.push(v));

    const stop = startPiholeCpPerfPolling(gw, bus, { sampleMs: 1000, uiAverageSamples: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(received).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(received).toHaveLength(1);
    stop();
  });

});
