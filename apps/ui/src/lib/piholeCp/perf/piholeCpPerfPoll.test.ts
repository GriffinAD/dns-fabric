import { afterEach, describe, expect, it, vi } from "vitest";

import { createFabricEventBus, perfUpdatedFullSummary } from "../../dashboard/bus/eventBus";
import type { PerfSummaryResponse } from "../../api/types";
import { PiholeCpDashboardGateway } from "../gateway/PiholeCpDashboardGateway";
import { startPiholeCpPerfPolling } from "../perf/piholeCpPerfPoll";

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

describe("startPiholeCpPerfPolling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it("does not poll again after stop", async () => {
    vi.useFakeTimers();
    const gw = new PiholeCpDashboardGateway("");
    const spy = vi.spyOn(gw, "getPerfSummary").mockResolvedValue(snap(10));
    const bus = createFabricEventBus(gw);
    const stop = startPiholeCpPerfPolling(gw, bus, { sampleMs: 1000, uiAverageSamples: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(spy).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).toHaveBeenCalledTimes(1);
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
