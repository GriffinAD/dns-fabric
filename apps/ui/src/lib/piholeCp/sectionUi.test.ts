import { describe, expect, it } from "vitest";

import {
  asRecord,
  boolish,
  containerHealthSuffix,
  containerLifecycleLabel,
  containerLifecycleTone,
  containerUptimeLabel,
  filterDeployedContainerRows,
  formatElapsedMs,
  isDeployedContainerRow,
  str,
} from "./sectionUi";

describe("sectionUi", () => {
  it("asRecord accepts plain objects", () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord(null)).toBeNull();
    expect(asRecord([])).toBeNull();
    expect(asRecord("x")).toBeNull();
  });

  it("boolish", () => {
    expect(boolish(true)).toBe(true);
    expect(boolish(false)).toBe(false);
  });

  it("str", () => {
    expect(str("a")).toBe("a");
    expect(str("")).toBeNull();
    expect(str(3)).toBe("3");
  });

  it("isDeployedContainerRow excludes not_found", () => {
    expect(isDeployedContainerRow({ name: "x", status: "not_found" })).toBe(false);
    expect(isDeployedContainerRow({ name: "x", status: "NOT_FOUND" })).toBe(false);
    expect(isDeployedContainerRow({ name: "x", status: "running" })).toBe(true);
    expect(isDeployedContainerRow(null)).toBe(false);
  });

  it("filterDeployedContainerRows", () => {
    const rows = [
      { name: "a", status: "running" },
      { name: "b", status: "not_found" },
    ];
    expect(filterDeployedContainerRows(rows)).toEqual([{ name: "a", status: "running" }]);
    expect(filterDeployedContainerRows("nope")).toEqual([]);
  });

  it("containerLifecycleLabel prefers status string", () => {
    expect(containerLifecycleLabel({ status: "exited", running: true })).toBe("exited");
    expect(containerLifecycleLabel({ running: true })).toBe("running");
    expect(containerLifecycleLabel({ running: false })).toBe("stopped");
    expect(containerLifecycleLabel({})).toBe("unknown");
  });

  it("containerHealthSuffix omits healthy", () => {
    expect(containerHealthSuffix({ health: "healthy" })).toBeNull();
    expect(containerHealthSuffix({ health: "unhealthy" })).toBe("unhealthy");
    expect(containerHealthSuffix({})).toBeNull();
  });

  it("containerLifecycleTone", () => {
    expect(containerLifecycleTone({ status: "running" })).toBe("ok");
    expect(containerLifecycleTone({ status: "dead" })).toBe("bad");
    expect(containerLifecycleTone({ status: "docker socket error" })).toBe("bad");
    expect(containerLifecycleTone({ status: "restarting" })).toBe("warn");
    expect(containerLifecycleTone({ status: "exited" })).toBe("neutral");
  });

  it("formatElapsedMs", () => {
    expect(formatElapsedMs(3_500)).toBe("3s");
    expect(formatElapsedMs(90_000)).toBe("1m");
    expect(formatElapsedMs(3_600_000)).toBe("1h");
    expect(formatElapsedMs(3_660_000)).toBe("1h 1m");
    expect(formatElapsedMs(172_800_000)).toBe("2d");
    expect(formatElapsedMs(176_400_000)).toBe("2d 1h");
    expect(formatElapsedMs(-1)).toBe("—");
    expect(formatElapsedMs(Number.NaN)).toBe("—");
  });

  it("containerUptimeLabel prefers uptime_seconds when running", () => {
    expect(containerUptimeLabel({ status: "running", uptime_seconds: 125 }, 0)).toBe("2m");
    expect(containerUptimeLabel({ status: "exited", uptime_seconds: 999 }, 0)).toBeNull();
  });

  it("containerUptimeLabel uses started_at when running", () => {
    const now = Date.parse("2026-05-13T12:00:00.000Z");
    const row = { status: "running", started_at: "2026-05-13T11:58:00.000Z" };
    expect(containerUptimeLabel(row, now)).toBe("2m");
  });

  it("containerUptimeLabel returns null without timing fields", () => {
    expect(containerUptimeLabel({ status: "running" }, Date.now())).toBeNull();
  });
});
