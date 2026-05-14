import { describe, expect, it } from "vitest";

import {
  asRecord,
  boolish,
  containerHealthSuffix,
  containerLifecycleLabel,
  containerLifecycleTone,
  filterDeployedContainerRows,
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
});
