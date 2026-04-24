import { describe, expect, it } from "vitest";

import { perfSummaryResponseSchema } from "../lib/api/openapiZod";

import { perfSummaryForTick } from "./perfSimulate";

describe("perfSummaryForTick", () => {
  it("parses as OpenAPI-shaped perf for several ticks", () => {
    for (const t of [0, 1, 2, 43, 100]) {
      const body = perfSummaryForTick(t);
      const parsed = perfSummaryResponseSchema.safeParse(body);
      expect(parsed.success, JSON.stringify(parsed.error)).toBe(true);
    }
  });

  it("keeps CPU and memory in sane bands", () => {
    const a = perfSummaryForTick(10);
    expect(a.cpu_percent_total).toBeGreaterThanOrEqual(2);
    expect(a.cpu_percent_total).toBeLessThanOrEqual(98);
    expect(a.memory_used_percent).toBeGreaterThanOrEqual(35);
    expect(a.memory_used_percent).toBeLessThanOrEqual(88);
    expect(a.cpu_core_percent?.length).toBe(4);
  });

  it("advances collected_at with tick", () => {
    const t0 = perfSummaryForTick(0).collected_at;
    const t1 = perfSummaryForTick(1).collected_at;
    expect(t1 > t0).toBe(true);
  });
});
