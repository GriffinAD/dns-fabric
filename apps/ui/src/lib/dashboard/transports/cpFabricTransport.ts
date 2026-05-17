import type { FabricEventBus } from "../eventBus";
import type { PerfSummaryResponse } from "../../api/types";
import type { PiholeCpDashboardGateway } from "../../piholeCp/PiholeCpDashboardGateway";
import {
  averagePerfSamples,
  extractDiskSnapshot,
  PIHOLE_CP_PERF_DISK_REFRESH_MS,
  PIHOLE_CP_PERF_SAMPLE_MS,
  PIHOLE_CP_PERF_UI_AVERAGE_SAMPLES,
  withDiskSnapshot,
} from "../../piholeCp/piholeCpPerfAggregate";

export {
  PIHOLE_CP_PERF_DISK_REFRESH_MS,
  PIHOLE_CP_PERF_SAMPLE_MS,
  PIHOLE_CP_PERF_UI_AVERAGE_SAMPLES,
} from "../../piholeCp/piholeCpPerfAggregate";

/** Sole owner of CP perf sampling; publishes only via `bus.emit("fabric.perf.updated", ...)`. */
export function startPiholeCpPerfPolling(
  gateway: PiholeCpDashboardGateway,
  bus: FabricEventBus,
  opts?: {
    sampleMs?: number;
    uiAverageSamples?: number;
    diskRefreshMs?: number;
    onFirstEmit?: () => void;
  },
): () => void {
  const sampleMs = opts?.sampleMs ?? PIHOLE_CP_PERF_SAMPLE_MS;
  const uiAverageSamples = opts?.uiAverageSamples ?? PIHOLE_CP_PERF_UI_AVERAGE_SAMPLES;
  const diskRefreshMs = opts?.diskRefreshMs ?? PIHOLE_CP_PERF_DISK_REFRESH_MS;

  let stopped = false;
  let firstEmitDone = false;
  let bucket: PerfSummaryResponse[] = [];
  let diskSnapshot = extractDiskSnapshot({
    cpu_percent_total: 0,
    memory_used_percent: 0,
    collected_at: "",
  });
  let lastDiskRefreshMs = 0;

  function maybeRefreshDisk(snap: PerfSummaryResponse, nowMs: number): void {
    if (lastDiskRefreshMs === 0 || nowMs - lastDiskRefreshMs >= diskRefreshMs) {
      diskSnapshot = extractDiskSnapshot(snap);
      lastDiskRefreshMs = nowMs;
    }
  }

  function emitToUi(body: PerfSummaryResponse): void {
    bus.emit("fabric.perf.updated", withDiskSnapshot(body, diskSnapshot));
  }

  const tick = async () => {
    if (stopped) return;
    let snap: PerfSummaryResponse;
    try {
      snap = await gateway.getPerfSummary();
    } catch {
      return;
    }

    const nowMs = Date.now();
    maybeRefreshDisk(snap, nowMs);

    if (!firstEmitDone) {
      firstEmitDone = true;
      emitToUi(snap);
      opts?.onFirstEmit?.();
      bucket = [];
      return;
    }

    bucket.push(snap);
    if (bucket.length < uiAverageSamples) return;

    const averaged = averagePerfSamples(bucket);
    bucket = [];
    if (averaged) emitToUi(averaged);
  };

  void tick();
  const timer = setInterval(() => void tick(), sampleMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export function attachCpFabricTransport(
  bus: FabricEventBus,
  gateway: PiholeCpDashboardGateway,
  opts?: {
    sampleMs?: number;
    uiAverageSamples?: number;
    diskRefreshMs?: number;
  },
): () => void {
  const transport = bus.declareTransport("cp-perf");
  transport.setState("connecting");
  const stopPoll = startPiholeCpPerfPolling(gateway, bus, {
    ...opts,
    onFirstEmit: () => transport.setState("open"),
  });
  return () => {
    stopPoll();
    transport.release();
  };
}
