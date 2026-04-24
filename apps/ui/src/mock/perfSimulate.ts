import type { PerfSummaryResponse } from "../lib/api/types";

import { MOCK_T0_ISO } from "./mockConstants";

const T0_MS = Date.parse(MOCK_T0_ISO);
/** Align synthetic `collected_at` with the Vite mock SSE interval. */
const MOCK_SSE_INTERVAL_MS = 3000;

function collectedAtIso(tick: number): string {
  return new Date(T0_MS + tick * MOCK_SSE_INTERVAL_MS).toISOString();
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Deterministic [-0.5, 0.5)-ish noise. */
function detNoise(tick: number, salt: number): number {
  const x = Math.imul((tick ^ salt) >>> 0, 0x9e3779b9) >>> 0;
  return (x % 1000) / 1000 - 0.5;
}

/**
 * Synthetic perf snapshot for simulate mode (tick 0 before first SSE, then 1, 2, …).
 * Python `perf_summary_for_tick` should match numerically for parity.
 */
export function perfSummaryForTick(tick: number): PerfSummaryResponse {
  const cpu = clamp(28 + 18 * Math.sin(tick * 0.12) + 4 * detNoise(tick, 1), 2, 98);
  const cores = [
    clamp(cpu + 5 * Math.sin(tick * 0.09), 0, 100),
    clamp(cpu + 5 * Math.sin(tick * 0.09 + 0.9), 0, 100),
    clamp(cpu + 5 * Math.sin(tick * 0.09 + 1.8), 0, 100),
    clamp(cpu + 5 * Math.sin(tick * 0.09 + 2.7), 0, 100),
  ];
  const memPct = clamp(52 + 20 * Math.sin(tick * 0.035) + 3 * detNoise(tick, 2), 35, 88);
  const memoryTotalBytes = 16_000_000_000;
  const memoryUsedBytes = Math.round((memPct / 100) * memoryTotalBytes);

  const netIn = clamp(6 + 5 * Math.sin(tick * 0.08) + 2 * detNoise(tick, 3), 0, 80);
  const netOut = clamp(2 + 3 * Math.sin(tick * 0.11) + 1.5 * detNoise(tick, 4), 0, 40);
  const eth0In = clamp(netIn * 0.72 + 0.5 * detNoise(tick, 5), 0, 80);
  const eth0Out = clamp(netOut * 0.65 + 0.4 * detNoise(tick, 6), 0, 40);
  const eth1In = clamp(netIn - eth0In, 0, 80);
  const eth1Out = clamp(netOut - eth0Out, 0, 40);

  const diskRoot = clamp(
    38 + Math.floor(tick / 18) * 1.2 + (tick % 43 === 0 ? 2.5 : 0) + 2 * detNoise(tick, 7),
    20,
    92,
  );
  const diskVar = clamp(diskRoot + 18 + 6 * Math.sin(tick * 0.02), 15, 96);

  return {
    cpu_percent_total: cpu,
    cpu_core_percent: cores,
    memory_used_percent: memPct,
    memory_used_bytes: memoryUsedBytes,
    memory_total_bytes: memoryTotalBytes,
    network_in_mbps: netIn,
    network_out_mbps: netOut,
    network_adapters: [
      { name: "eth0", in_mbps: eth0In, out_mbps: eth0Out },
      { name: "eth1", in_mbps: eth1In, out_mbps: eth1Out },
    ],
    disk_used_percent: diskRoot,
    disk_volumes: [
      { label: "/", used_percent: diskRoot },
      { label: "/var", used_percent: diskVar },
    ],
    collected_at: collectedAtIso(tick),
  };
}
