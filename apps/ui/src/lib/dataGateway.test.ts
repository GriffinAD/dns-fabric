import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardLayout } from "./dashboard/types";
import { DataGateway } from "./dataGateway";

describe("DataGateway", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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
    expect(fetch).toHaveBeenCalledWith("https://example.test/api/v1/meta", { headers: {} });
  });

  it("uses VITE_API_BASE_URL when constructor baseUrl is empty", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ api_version: "1.0.0", service: "kea-fabric" }),
      }),
    );
    const gw = new DataGateway();
    await gw.getMeta();
    expect(fetch).toHaveBeenCalledWith("https://api.example/api/v1/meta", { headers: {} });
  });

  it("uses VITE_API_AUTH_TOKEN when options omit authToken", async () => {
    vi.stubEnv("VITE_API_AUTH_TOKEN", "from-env");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      }),
    );
    const gw = new DataGateway("");
    await gw.listPlugins();
    expect(fetch).toHaveBeenCalledWith("/api/v1/plugins", {
      headers: { Authorization: "Bearer from-env" },
    });
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

  it("putDashboardLayout sends PUT without reading body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );
    const gw = new DataGateway("");
    const layout: DashboardLayout = { version: 1, tiles: [] };
    await gw.putDashboardLayout("default", layout);
    expect(fetch).toHaveBeenCalledWith("/api/v1/dashboards/default/layout", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    });
  });

  it("putDashboardLayout sends Authorization when authToken option set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );
    const gw = new DataGateway("", { authToken: "tok" });
    const layout: DashboardLayout = { version: 1, tiles: [] };
    await gw.putDashboardLayout("default", layout);
    expect(fetch).toHaveBeenCalledWith("/api/v1/dashboards/default/layout", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: JSON.stringify(layout),
    });
  });

  it("resetDashboardLayout sends POST and returns layout JSON", async () => {
    const body: DashboardLayout = { version: 1, tiles: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(body),
      }),
    );
    const gw = new DataGateway("");
    const out = await gw.resetDashboardLayout("default");
    expect(out).toEqual(body);
    expect(fetch).toHaveBeenCalledWith("/api/v1/dashboards/default/layout/reset", {
      method: "POST",
      headers: {},
    });
  });

  it("resetDashboardLayout throws when POST is not OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }),
    );
    const gw = new DataGateway("");
    await expect(gw.resetDashboardLayout("default")).rejects.toThrow(
      /POST \/api\/v1\/dashboards\/default\/layout\/reset failed: 404/,
    );
  });

  it("pauseDiscoveryScan posts body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ state: "paused", updated_at: "t", record_count: 0 }),
      }),
    );
    const gw = new DataGateway("");
    const r = await gw.pauseDiscoveryScan(true);
    expect(r.state).toBe("paused");
    expect(fetch).toHaveBeenCalledWith("/api/v1/discovery/scan/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: true }),
    });
  });

  it("subscribeFabricEvents wires EventSource", () => {
    const closeFn = vi.fn();
    class MockES {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = closeFn;
    }
    const instances: MockES[] = [];
    vi.stubGlobal(
      "EventSource",
      vi.fn().mockImplementation(() => {
        const inst = new MockES();
        instances.push(inst);
        return inst;
      }),
    );
    const gw = new DataGateway("");
    const onEvent = vi.fn();
    const unsub = gw.subscribeFabricEvents(onEvent);
    expect(EventSource).toHaveBeenCalledWith("/api/v1/events/stream");
    instances[0].onmessage?.({ data: JSON.stringify({ topic: "t", occurred_at: "now", payload: {} }) } as MessageEvent);
    expect(onEvent).toHaveBeenCalled();
    unsub();
    expect(closeFn).toHaveBeenCalled();
  });

  it("subscribeFabricEvents passes access_token query when authToken set", () => {
    class MockES {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
    }
    vi.stubGlobal(
      "EventSource",
      vi.fn().mockImplementation(() => new MockES()),
    );
    const gw = new DataGateway("", { authToken: "abc" });
    gw.subscribeFabricEvents(() => {});
    expect(EventSource).toHaveBeenCalledWith("/api/v1/events/stream?access_token=abc");
  });

  it("subscribeFabricEvents forwards stream errors", () => {
    class MockES {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
    }
    const instances: MockES[] = [];
    vi.stubGlobal(
      "EventSource",
      vi.fn().mockImplementation(() => {
        const inst = new MockES();
        instances.push(inst);
        return inst;
      }),
    );
    const onErr = vi.fn();
    const gw = new DataGateway("");
    gw.subscribeFabricEvents(() => {}, onErr);
    instances[0].onerror?.();
    expect(onErr).toHaveBeenCalledWith("event source error");
  });

  it("subscribeFabricEvents reports invalid payloads", () => {
    class MockES {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
    }
    const instances: MockES[] = [];
    vi.stubGlobal(
      "EventSource",
      vi.fn().mockImplementation(() => {
        const inst = new MockES();
        instances.push(inst);
        return inst;
      }),
    );
    const onErr = vi.fn();
    const gw = new DataGateway("");
    gw.subscribeFabricEvents(() => {}, onErr);
    instances[0].onmessage?.({ data: "not-json" } as MessageEvent);
    expect(onErr).toHaveBeenCalledWith("invalid event payload");
  });

  it("subscribeFabricEvents no-ops when EventSource missing", () => {
    vi.stubGlobal("EventSource", undefined);
    const gw = new DataGateway("");
    const u = gw.subscribeFabricEvents(() => {});
    u();
  });

  it("putDashboardLayout throws on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, statusText: "bad" }),
    );
    const gw = new DataGateway("");
    await expect(gw.putDashboardLayout("x", { version: 1, tiles: [] })).rejects.toThrow(/400/);
  });

  it("pauseDiscoveryScan throws on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "err" }),
    );
    const gw = new DataGateway("");
    await expect(gw.pauseDiscoveryScan(true)).rejects.toThrow(/500/);
  });

  const endpointCases = [
    ["getHealth", (g: DataGateway) => g.getHealth(), { status: "ok", checked_at: "t" }],
    ["listPlugins", (g: DataGateway) => g.listPlugins(), { items: [] }],
    ["listDhcpPools", (g: DataGateway) => g.listDhcpPools(), { items: [] }],
    ["listDhcpClients", (g: DataGateway) => g.listDhcpClients(), { items: [] }],
    ["listDhcpReservations", (g: DataGateway) => g.listDhcpReservations(), { items: [] }],
    ["listDiscoveryRecords", (g: DataGateway) => g.listDiscoveryRecords(), { items: [] }],
    ["getDiscoveryScan", (g: DataGateway) => g.getDiscoveryScan(), { state: "idle", updated_at: "t" }],
    ["getPerfSummary", (g: DataGateway) => g.getPerfSummary(), { cpu_percent_total: 1, memory_used_percent: 2, collected_at: "t" }],
    [
      "getDashboardLayout",
      (g: DataGateway) => g.getDashboardLayout("default"),
      { version: 1, tiles: [] },
    ],
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
