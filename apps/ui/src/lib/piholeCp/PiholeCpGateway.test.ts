import { afterEach, describe, expect, it, vi } from "vitest";

import { dashboardResponseSchema } from "./dashboardZod";
import { PiholeCpGateway, joinControlPlaneUrl } from "./PiholeCpGateway";

describe("joinControlPlaneUrl", () => {
  it("joins base and path with single slash boundary", () => {
    expect(joinControlPlaneUrl("http://192.0.2.1:8091", "/dashboard")).toBe("http://192.0.2.1:8091/dashboard");
    expect(joinControlPlaneUrl("http://192.0.2.1:8091/", "/dashboard")).toBe("http://192.0.2.1:8091/dashboard");
  });

  it("adds leading slash when path omits it", () => {
    expect(joinControlPlaneUrl("http://192.0.2.1:8091", "v1/meta")).toBe("http://192.0.2.1:8091/v1/meta");
  });
});

describe("dashboardResponseSchema", () => {
  it("accepts minimal dashboard payload", () => {
    const parsed = dashboardResponseSchema.parse({
      node: "pi2",
      version: "0.4.0",
      widgets: [{ id: "ha_summary", title: "HA", section: "ha" }],
      sections: { ha: { ok: true } },
    });
    expect(parsed.node).toBe("pi2");
  });

  it("rejects unknown top-level keys", () => {
    expect(() =>
      dashboardResponseSchema.parse({
        node: "pi2",
        version: "0.4.0",
        widgets: [{ id: "ha_summary", title: "HA", section: "ha" }],
        sections: { ha: { ok: true } },
        extra: true,
      }),
    ).toThrow();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PiholeCpGateway", () => {
  it("loads dashboard", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        node: "pi2",
        version: "0.4.0",
        widgets: [{ id: "ha_summary", title: "HA", section: "ha" }],
        sections: { ha: { ok: true } },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const gw = new PiholeCpGateway("");
    const dash = await gw.getDashboard();
    expect(dash.node).toBe("pi2");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/dashboard"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws GatewayError on HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.getDashboard()).rejects.toMatchObject({
      name: "GatewayError",
      code: "http_error",
      status: 503,
    });
  });

  it("throws GatewayError parse_failed when body does not match schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ node: "x" }),
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.getDashboard()).rejects.toMatchObject({
      name: "GatewayError",
      code: "parse_failed",
    });
  });

  it("throws GatewayError when JSON parse fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("not json");
        },
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.getDashboard()).rejects.toMatchObject({
      name: "GatewayError",
      code: "parse_failed",
    });
  });

  it("loads logs catalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          logs: [
            {
              id: "docker_pihole",
              label: "Pi-hole (container)",
              kind: "docker_logs",
            },
          ],
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const cat = await gw.getLogsCatalog();
    expect(cat.logs[0]?.id).toBe("docker_pihole");
  });

  it("throws on logs catalog HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({}),
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.getLogsCatalog()).rejects.toMatchObject({
      name: "GatewayError",
      code: "http_error",
      status: 502,
    });
  });

  it("loads meta with defaults", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
      })),
    );
    const gw = new PiholeCpGateway("");
    const meta = await gw.getMeta();
    expect(meta.node).toBe("unknown");
    expect(meta.peer_ui_base_url).toBeNull();
    expect(meta.kea_fabric_api_base_url).toBeNull();
    expect(meta.dhcp_mode).toBeNull();
  });

  it("loads meta with explicit fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          peer_ui_base_url: "http://peer:8091",
          node: "pi1",
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const meta = await gw.getMeta();
    expect(meta.node).toBe("pi1");
    expect(meta.peer_ui_base_url).toBe("http://peer:8091");
    expect(meta.kea_fabric_api_base_url).toBeNull();
    expect(meta.dhcp_mode).toBeNull();
  });

  it("loads meta with kea_fabric_api_base_url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          peer_ui_base_url: null,
          node: "pi2",
          kea_fabric_api_base_url: "http://192.0.2.10:8080",
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const meta = await gw.getMeta();
    expect(meta.kea_fabric_api_base_url).toBe("http://192.0.2.10:8080");
  });

  it("loads meta with dhcp_mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          peer_ui_base_url: null,
          node: "pi2",
          dhcp_mode: "kea",
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const meta = await gw.getMeta();
    expect(meta.dhcp_mode).toBe("kea");
  });

  it("throws on meta HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({}),
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.getMeta()).rejects.toMatchObject({
      name: "GatewayError",
      code: "http_error",
      status: 401,
    });
  });

  it("rejects unknown keys in meta JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ node: "n", extra: 1 }),
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.getMeta()).rejects.toMatchObject({
      name: "GatewayError",
      code: "parse_failed",
    });
  });
});
