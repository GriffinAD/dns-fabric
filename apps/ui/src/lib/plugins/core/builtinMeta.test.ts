import { describe, expect, it } from "vitest";

import { builtinDefaultColSpan, perfGridHintOnlyExpandColSpan } from "./builtinMeta";

describe("builtinMeta", () => {
  it("builtinDefaultColSpan matches perf and default width policy", () => {
    expect(builtinDefaultColSpan("perf.summary")).toBe(20);
    expect(builtinDefaultColSpan("perf.cpu")).toBe(1);
    expect(builtinDefaultColSpan("perf.ram")).toBe(1);
    expect(builtinDefaultColSpan("perf.network")).toBe(1);
    expect(builtinDefaultColSpan("perf.disk")).toBe(1);
    expect(builtinDefaultColSpan("dhcp.pools")).toBeUndefined();
    expect(builtinDefaultColSpan("discovery.records")).toBeUndefined();
  });

  it("perfGridHintOnlyExpandColSpan is true for cpu, ram, network, disk (not perf.summary)", () => {
    expect(perfGridHintOnlyExpandColSpan("perf.cpu")).toBe(true);
    expect(perfGridHintOnlyExpandColSpan("perf.ram")).toBe(true);
    expect(perfGridHintOnlyExpandColSpan("perf.network")).toBe(true);
    expect(perfGridHintOnlyExpandColSpan("perf.disk")).toBe(true);
    expect(perfGridHintOnlyExpandColSpan("perf.summary")).toBe(false);
  });
});
