import { describe, expect, it } from "vitest";

import { pluginIdsEqual } from "./pluginIds";

describe("pluginIdsEqual", () => {
  it("returns true for the same id", () => {
    expect(pluginIdsEqual("dhcp.pools", "dhcp.pools")).toBe(true);
  });

  it("returns false for different ids", () => {
    expect(pluginIdsEqual("dhcp.pools", "dhcp.clients")).toBe(false);
  });
});
