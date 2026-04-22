import { describe, expect, it } from "vitest";

import { mockRoutes } from "../mock/routes";

/** Paths declared in specs/api/openapi.yaml (GET /api/v1 relative to server root). */
const requiredPaths = [
  "/api/v1/health",
  "/api/v1/meta",
  "/api/v1/plugins",
  "/api/v1/dhcp/pools",
  "/api/v1/dhcp/clients",
  "/api/v1/dhcp/reservations",
  "/api/v1/discovery/records",
  "/api/v1/perf/summary",
] as const;

describe("mock API routes", () => {
  for (const path of requiredPaths) {
    it(`defines fixture for ${path}`, () => {
      expect(mockRoutes[path]).toBeDefined();
    });
  }
});
