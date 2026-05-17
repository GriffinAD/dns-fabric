import { describe, expect, it } from "vitest";

import type { PerfSummaryResponse } from "../../api/types";
import {
  averagePerfSamples,
  extractDiskSnapshot,
  withDiskSnapshot,
} from "../perf/piholeCpPerfAggregate";

const base = (n: number): PerfSummaryResponse => ({
  cpu_percent_total: n,
  cpu_core_percent: [n, n + 1],
  memory_used_percent: n * 2,
  memory_used_bytes: 100 * n,
  memory_total_bytes: 1000,
  network_in_mbps: n * 0.1,
  network_out_mbps: n * 0.2,
  disk_used_percent: 50 + n,
  disk_volumes: [{ label: "/", used_percent: 50 + n }],
  collected_at: `2026-01-0${n}T00:00:00Z`,
});

describe("averagePerfSamples", () => {
  it("averages CPU RAM and network across samples", () => {
    const avg = averagePerfSamples([base(10), base(20), base(30)])!;
    expect(avg.cpu_percent_total).toBe(20);
    expect(avg.cpu_core_percent).toEqual([20, 21]);
    expect(avg.memory_used_percent).toBe(40);
    expect(avg.network_in_mbps).toBeCloseTo(2);
    expect(avg.collected_at).toBe(base(30).collected_at);
  });

  it("omits disk fields from averaged body", () => {
    const avg = averagePerfSamples([base(1), base(3)])!;
    expect(avg.disk_used_percent).toBeUndefined();
    expect(avg.disk_volumes).toBeUndefined();
  });

  it("omits network_adapters when samples have no adapter lists", () => {
    const avg = averagePerfSamples([base(10), base(20)])!;
    expect(avg.network_adapters).toBeUndefined();
  });

  it("averages per-adapter network throughput", () => {
    const withEth = (n: number): PerfSummaryResponse => ({
      ...base(n),
      network_adapters: [{ name: "eth0", in_mbps: n, out_mbps: n * 2 }],
    });
    const avg = averagePerfSamples([withEth(10), withEth(20)])!;
    expect(avg.network_adapters).toEqual([{ name: "eth0", in_mbps: 15, out_mbps: 30 }]);
  });

  it("returns a single sample unchanged", () => {
    const one = base(5);
    expect(averagePerfSamples([one])).toEqual(one);
  });

  it("returns null for an empty sample list", () => {
    expect(averagePerfSamples([])).toBeNull();
  });

  it("omits averaged core percent when samples lack core arrays", () => {
    const noCores: PerfSummaryResponse = { ...base(10), cpu_core_percent: undefined };
    expect(averagePerfSamples([noCores, { ...base(20), cpu_core_percent: undefined }])!.cpu_core_percent).toBeUndefined();
  });

  it("handles sparse core and memory fields", () => {
    const sparse: PerfSummaryResponse = {
      ...base(10),
      cpu_core_percent: undefined,
      memory_used_bytes: null,
      memory_total_bytes: Number.NaN,
    };
    const avg = averagePerfSamples([sparse, { ...sparse, cpu_percent_total: 20 }])!;
    expect(avg.cpu_core_percent).toBeUndefined();
    expect(avg.memory_used_bytes).toBeNull();
    expect(avg.memory_total_bytes).toBeNull();
  });
});

describe("withDiskSnapshot", () => {
  it("overlays cached disk on averaged body", () => {
    const body = averagePerfSamples([base(10), base(20)])!;
    const merged = withDiskSnapshot(body, extractDiskSnapshot(base(99)));
    expect(merged.disk_used_percent).toBe(149);
    expect(merged.cpu_percent_total).toBe(15);
  });
});
