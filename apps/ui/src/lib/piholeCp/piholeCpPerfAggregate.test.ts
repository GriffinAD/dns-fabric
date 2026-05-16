import { describe, expect, it } from "vitest";

import type { PerfSummaryResponse } from "../api/types";
import {
  averagePerfSamples,
  extractDiskSnapshot,
  withDiskSnapshot,
} from "./piholeCpPerfAggregate";

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
});

describe("withDiskSnapshot", () => {
  it("overlays cached disk on averaged body", () => {
    const body = averagePerfSamples([base(10), base(20)])!;
    const merged = withDiskSnapshot(body, extractDiskSnapshot(base(99)));
    expect(merged.disk_used_percent).toBe(149);
    expect(merged.cpu_percent_total).toBe(15);
  });
});
