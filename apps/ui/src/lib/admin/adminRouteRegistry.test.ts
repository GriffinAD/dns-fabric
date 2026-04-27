import { describe, expect, it } from "vitest";

import { resolveAdminRoute } from "./adminRouteRegistry";

describe("adminRouteRegistry", () => {
  it("resolves logs route", () => {
    expect(resolveAdminRoute("logs")).not.toBeNull();
  });

  it("resolves the sample extension route", () => {
    expect(resolveAdminRoute("ext/sample")).not.toBeNull();
  });

  it("returns null for unknown subpaths", () => {
    expect(resolveAdminRoute("unknown/path")).toBeNull();
  });
});
