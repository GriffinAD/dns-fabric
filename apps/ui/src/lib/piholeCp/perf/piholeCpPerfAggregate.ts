import type { PerfSummaryResponse } from "../../api/types";

/** Sample host perf every 1s; emit to the UI every 3 samples (averaged). */
export const PIHOLE_CP_PERF_SAMPLE_MS = 1000;
/** Disk gauges refresh at most once per minute. */
export const PIHOLE_CP_PERF_DISK_REFRESH_MS = 60_000;
/** Number of 1s samples averaged per UI update after the first immediate emit. */
export const PIHOLE_CP_PERF_UI_AVERAGE_SAMPLES = 3;

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function meanNullable(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return mean(nums);
}

function averageCorePercent(samples: PerfSummaryResponse[]): number[] | undefined {
  const arrays = samples.map((s) => s.cpu_core_percent).filter((a): a is number[] => Array.isArray(a));
  if (arrays.length === 0) return undefined;
  const n = Math.max(...arrays.map((a) => a.length));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const vals = arrays.map((a) => a[i]).filter((v): v is number => typeof v === "number");
    if (vals.length > 0) out.push(mean(vals));
  }
  return out.length > 0 ? out : undefined;
}

function averageNetworkAdapters(samples: PerfSummaryResponse[]) {
  const byName = new Map<string, { in_mbps: number[]; out_mbps: number[] }>();
  for (const s of samples) {
    for (const a of s.network_adapters ?? []) {
      let e = byName.get(a.name);
      if (!e) {
        e = { in_mbps: [], out_mbps: [] };
        byName.set(a.name, e);
      }
      e.in_mbps.push(a.in_mbps);
      e.out_mbps.push(a.out_mbps);
    }
  }
  if (byName.size === 0) return undefined;
  return [...byName.entries()].map(([name, v]) => ({
    name,
    in_mbps: mean(v.in_mbps),
    out_mbps: mean(v.out_mbps),
  }));
}

/** Average CPU/RAM/network fields across recent 1s samples (not disk). */
export function averagePerfSamples(samples: PerfSummaryResponse[]): PerfSummaryResponse | null {
  if (samples.length === 0) return null;
  const latest = samples[samples.length - 1]!;
  if (samples.length === 1) return { ...latest };

  return {
    cpu_percent_total: mean(samples.map((s) => s.cpu_percent_total)),
    cpu_core_percent: averageCorePercent(samples),
    memory_used_percent: mean(samples.map((s) => s.memory_used_percent)),
    memory_used_bytes: meanNullable(samples.map((s) => s.memory_used_bytes)),
    memory_total_bytes: meanNullable(samples.map((s) => s.memory_total_bytes)),
    network_in_mbps: meanNullable(samples.map((s) => s.network_in_mbps)),
    network_out_mbps: meanNullable(samples.map((s) => s.network_out_mbps)),
    network_adapters: averageNetworkAdapters(samples),
    collected_at: latest.collected_at,
  };
}

export type PerfDiskSnapshot = Pick<
  PerfSummaryResponse,
  "disk_used_percent" | "disk_volumes"
>;

export function extractDiskSnapshot(s: PerfSummaryResponse): PerfDiskSnapshot {
  return {
    disk_used_percent: s.disk_used_percent,
    disk_volumes: s.disk_volumes,
  };
}

export function withDiskSnapshot(
  body: PerfSummaryResponse,
  disk: PerfDiskSnapshot,
): PerfSummaryResponse {
  return {
    ...body,
    disk_used_percent: disk.disk_used_percent,
    disk_volumes: disk.disk_volumes,
  };
}
