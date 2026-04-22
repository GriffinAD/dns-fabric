import { afterEach, describe, expect, it, vi } from "vitest";

import { DataGateway } from "./dataGateway";

describe("DataGateway", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getMeta parses JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ api_version: "1.0.0", service: "kea-fabric" }),
      }),
    );
    const gw = new DataGateway("https://example.test");
    const m = await gw.getMeta();
    expect(m.service).toBe("kea-fabric");
    expect(fetch).toHaveBeenCalledWith("https://example.test/api/v1/meta");
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "unavailable",
      }),
    );
    const gw = new DataGateway("");
    await expect(gw.listPlugins()).rejects.toThrow(/503/);
  });

  const endpointCases = [
    ["listPlugins", (g: DataGateway) => g.listPlugins(), { items: [] }],
    ["listDhcpPools", (g: DataGateway) => g.listDhcpPools(), { items: [] }],
    ["listDhcpClients", (g: DataGateway) => g.listDhcpClients(), { items: [] }],
    ["listDhcpReservations", (g: DataGateway) => g.listDhcpReservations(), { items: [] }],
    ["listDiscoveryRecords", (g: DataGateway) => g.listDiscoveryRecords(), { items: [] }],
    ["getPerfSummary", (g: DataGateway) => g.getPerfSummary(), { cpu_percent_total: 1, memory_used_percent: 2, collected_at: "t" }],
  ] as const;

  for (const [name, call, body] of endpointCases) {
    it(`${name} uses GET and parses JSON`, async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(body),
        }),
      );
      const gw = new DataGateway("");
      const result = await call(gw);
      expect(result).toEqual(body);
      const path = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(path).toMatch(/^\/api\/v1\//);
    });
  }
});
