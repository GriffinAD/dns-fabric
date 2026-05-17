import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./piholeCpPostApplyWait", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./piholeCpPostApplyWait")>();
  return { ...mod, sleep: vi.fn(async () => undefined) };
});

import { dashboardResponseSchema } from "./dashboardZod";
import {
  PiholeCpGateway,
  controlPlaneErrorMessage,
  joinControlPlaneUrl,
  waitForControlPlaneReady,
  waitForControlPlaneRestart,
  waitForEnvPendingCleared,
  waitForHostEnvApplyComplete,
  waitForPiholeCpDashboardCoherent,
} from "./PiholeCpGateway";
import type { DashboardResponse } from "./dashboardZod";

describe("controlPlaneErrorMessage", () => {
  it("returns fallback for non-objects", () => {
    expect(controlPlaneErrorMessage(null, "fb")).toBe("fb");
  });

  it("extracts validation detail arrays", () => {
    expect(
      controlPlaneErrorMessage({ detail: [{ msg: "field required" }] }, "fb"),
    ).toBe("field required");
  });

  it("extracts error and message fields", () => {
    expect(
      controlPlaneErrorMessage({ error: "forbidden_key", message: "not allowed" }, "fb"),
    ).toBe("forbidden_key: not allowed");
    expect(controlPlaneErrorMessage({ message: "only message" }, "fb")).toBe("only message");
  });
});

describe("waitForEnvPendingCleared", () => {
  it("uses default attempts when opts are omitted", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    vi.spyOn(gw, "getEnvConfig")
      .mockResolvedValueOnce({ effective: {}, pending: { DNSCRYPT_PROXY_ENABLED: "1" } })
      .mockResolvedValueOnce({ effective: {}, pending: null });
    await waitForEnvPendingCleared(gw);
    expect(gw.getEnvConfig).toHaveBeenCalledTimes(2);
  });

  it("resolves when pending is cleared", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    vi.spyOn(gw, "getEnvConfig")
      .mockResolvedValueOnce({ effective: {}, pending: { DNSCRYPT_PROXY_ENABLED: "1" } })
      .mockResolvedValueOnce({ effective: { DNSCRYPT_PROXY_ENABLED: "1" }, pending: null });
    const env = await waitForEnvPendingCleared(gw, { attempts: 5, delayMs: 1 });
    expect(env.pending).toBeNull();
  });

  it("reports slow apply progress and throws on timeout", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    const labels: string[] = [];
    vi.spyOn(gw, "getEnvConfig").mockResolvedValue({
      effective: {},
      pending: { DNSCRYPT_PROXY_ENABLED: "1" },
    });
    await expect(
      waitForEnvPendingCleared(gw, {
        attempts: 7,
        delayMs: 1,
        onProgress: (label) => labels.push(label),
      }),
    ).rejects.toMatchObject({ path: "/v1/config/env" });
    expect(labels).toContain("Still waiting for host apply…");
  });
});

describe("waitForHostEnvApplyComplete", () => {
  it("resolves when pending is cleared", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    vi.spyOn(gw, "getEnvConfig")
      .mockResolvedValueOnce({
        effective: { DNSCRYPT_PROXY_ENABLED: "0" },
        pending: { DNSCRYPT_PROXY_ENABLED: "1" },
      })
      .mockResolvedValueOnce({
        effective: { DNSCRYPT_PROXY_ENABLED: "1" },
        pending: null,
      });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
      })),
    );
    const env = await waitForHostEnvApplyComplete("http://127.0.0.1:8091", gw, {
      maxMs: 5000,
      pollMs: 1,
    });
    expect(env.pending).toBeNull();
  });

  it("reports health and pending progress before pending clears", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    const labels: string[] = [];
    let envCalls = 0;
    vi.spyOn(gw, "getEnvConfig").mockImplementation(async () => {
      envCalls += 1;
      if (envCalls < 9) {
        return { effective: {}, pending: { DNSCRYPT_PROXY_ENABLED: "1" } };
      }
      return { effective: { DNSCRYPT_PROXY_ENABLED: "1" }, pending: null };
    });
    let fetchCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return { ok: true, status: 200 };
        if (fetchCalls <= 3) return { ok: false, status: 503 };
        return { ok: true, status: 200 };
      }),
    );
    await waitForHostEnvApplyComplete("http://127.0.0.1:8091", gw, {
      maxMs: 5000,
      pollMs: 1,
      onProgress: (label) => labels.push(label),
    });
    expect(labels.some((l) => l.includes("Stack restarting"))).toBe(true);
    expect(labels.some((l) => l.includes("Still applying"))).toBe(true);
  });

  it("tolerates getEnvConfig errors while the stack restarts", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    vi.spyOn(gw, "getEnvConfig")
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce({ effective: {}, pending: null });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    const env = await waitForHostEnvApplyComplete("http://127.0.0.1:8091", gw, {
      maxMs: 5000,
      pollMs: 1,
    });
    expect(env.pending).toBeNull();
  });

  it("uses default maxMs when opts are omitted", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    vi.spyOn(gw, "getEnvConfig").mockResolvedValue({ effective: {}, pending: null });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    await waitForHostEnvApplyComplete("http://127.0.0.1:8091", gw);
    expect(gw.getEnvConfig).toHaveBeenCalled();
  });

  it("throws when pending never clears", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    vi.spyOn(gw, "getEnvConfig").mockResolvedValue({
      effective: {},
      pending: { DNSCRYPT_PROXY_ENABLED: "1" },
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    await expect(
      waitForHostEnvApplyComplete("http://127.0.0.1:8091", gw, { maxMs: 30, pollMs: 5 }),
    ).rejects.toMatchObject({ path: "/v1/config/env" });
  });

  it("treats health fetch failures as down", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    vi.spyOn(gw, "getEnvConfig")
      .mockResolvedValueOnce({ effective: {}, pending: { DNSCRYPT_PROXY_ENABLED: "1" } })
      .mockResolvedValueOnce({ effective: {}, pending: null });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    const env = await waitForHostEnvApplyComplete("http://127.0.0.1:8091", gw, {
      maxMs: 5000,
      pollMs: 1,
    });
    expect(env.pending).toBeNull();
  });
});

const coherentDash: DashboardResponse = {
  node: "pi2",
  version: "1",
  widgets: [],
  sections: { ha: { dhcp_mode: "none" } },
};

describe("waitForPiholeCpDashboardCoherent", () => {
  it("uses default attempts when opts are omitted", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    vi.spyOn(gw, "getDashboard").mockResolvedValue(coherentDash);
    vi.spyOn(gw, "getMeta").mockResolvedValue({
      node: "pi2",
      peer_ui_base_url: null,
      kea_fabric_api_base_url: null,
      dhcp_mode: "none",
    });
    await waitForPiholeCpDashboardCoherent(gw);
    expect(gw.getDashboard).toHaveBeenCalled();
  });

  it("resolves when dashboard matches meta", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    vi.spyOn(gw, "getDashboard").mockResolvedValue(coherentDash);
    vi.spyOn(gw, "getMeta").mockResolvedValue({
      node: "pi2",
      peer_ui_base_url: null,
      kea_fabric_api_base_url: null,
      dhcp_mode: "none",
    });
    const out = await waitForPiholeCpDashboardCoherent(gw, { attempts: 2, delayMs: 1 });
    expect(out.dashboard.node).toBe("pi2");
  });

  it("retries after fetch errors and reports sync progress", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    const labels: string[] = [];
    let dashCalls = 0;
    vi.spyOn(gw, "getDashboard").mockImplementation(async () => {
      dashCalls += 1;
      if (dashCalls === 1) throw new Error("starting");
      return coherentDash;
    });
    vi.spyOn(gw, "getMeta").mockResolvedValue({
      node: "pi2",
      peer_ui_base_url: null,
      kea_fabric_api_base_url: null,
      dhcp_mode: "none",
    });
    await waitForPiholeCpDashboardCoherent(gw, {
      attempts: 8,
      delayMs: 1,
      onProgress: (label) => labels.push(label),
    });
    expect(labels).toContain("Syncing dashboard…");
    expect(labels).toContain("Dashboard updated");
  });

  it("throws when dashboard never matches meta", async () => {
    const gw = new PiholeCpGateway("http://127.0.0.1:8091");
    const labels: string[] = [];
    const incoherent = {
      ...coherentDash,
      widgets: [{ id: "w1", title: "DHCP", section: "kea_dhcp" }],
    };
    vi.spyOn(gw, "getDashboard").mockResolvedValue(incoherent);
    vi.spyOn(gw, "getMeta").mockResolvedValue({
      node: "pi2",
      peer_ui_base_url: null,
      kea_fabric_api_base_url: null,
      dhcp_mode: "none",
    });
    await expect(
      waitForPiholeCpDashboardCoherent(gw, {
        attempts: 7,
        delayMs: 1,
        onProgress: (label) => labels.push(label),
      }),
    ).rejects.toMatchObject({ path: "/dashboard" });
    expect(labels).toContain("Still syncing dashboard…");
  });
});

describe("waitForControlPlaneRestart", () => {
  it("uses default timing when opts are omitted", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls <= 2) return { ok: true, status: 200 };
        if (calls <= 4) return { ok: false, status: 503 };
        return { ok: true, status: 200 };
      }),
    );
    await waitForControlPlaneRestart("http://127.0.0.1:8091");
    expect(calls).toBeGreaterThan(3);
  });

  it("waits for health down then up", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        // grace + polls: ok, ok, fail, fail, ok
        if (calls <= 2) return { ok: true, status: 200 };
        if (calls <= 4) return { ok: false, status: 503 };
        return { ok: true, status: 200 };
      }),
    );
    await waitForControlPlaneRestart("http://127.0.0.1:8091", {
      graceMs: 1,
      pollMs: 1,
      waitForDownMs: 5000,
      waitForUpAttempts: 5,
    });
    expect(calls).toBeGreaterThan(3);
  });

  it("throws when health never goes down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
      })),
    );
    await expect(
      waitForControlPlaneRestart("http://127.0.0.1:8091", {
        graceMs: 1,
        pollMs: 1,
        waitForDownMs: 20,
      }),
    ).rejects.toMatchObject({ path: "/health" });
  });
});

describe("waitForControlPlaneReady", () => {
  it("uses default attempts and delay when opts are omitted", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return { ok: calls >= 2, status: 200 };
      }),
    );
    await waitForControlPlaneReady("http://127.0.0.1:8091");
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it("resolves when /health returns ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
      })),
    );
    await waitForControlPlaneReady("http://127.0.0.1:8091", { attempts: 2, delayMs: 1 });
  });

  it("throws when /health never succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Load failed");
      }),
    );
    await expect(
      waitForControlPlaneReady("http://127.0.0.1:8091", { attempts: 2, delayMs: 1 }),
    ).rejects.toMatchObject({ code: "http_error", path: "/health" });
  });
});

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

  it("throws GatewayError on HTTP failure with JSON detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not Found" }),
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.getEnvConfig()).rejects.toMatchObject({
      code: "http_error",
      status: 404,
      message: "Not Found",
    });
  });

  it("throws GatewayError on HTTP failure when body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("not json");
        },
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.getEnvConfig()).rejects.toMatchObject({
      code: "http_error",
      status: 502,
    });
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

  it("patchEnvConfig stages changes with token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 202,
        json: async () => ({
          staged: { DNSCRYPT_PROXY_ENABLED: "1" },
          pending: { DNSCRYPT_PROXY_ENABLED: "1" },
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const res = await gw.patchEnvConfig({ DNSCRYPT_PROXY_ENABLED: "1" }, "secret");
    expect(res.staged.DNSCRYPT_PROXY_ENABLED).toBe("1");
  });

  it("loads env schema and config", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/schema")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              keys: [
                {
                  key: "DNSCRYPT_PROXY_ENABLED",
                  tier: 1,
                  type: "boolean",
                  label: "DNSCrypt",
                  requires_apply: true,
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ effective: { DNSCRYPT_PROXY_ENABLED: "0" }, pending: null }),
        };
      }),
    );
    const gw = new PiholeCpGateway("");
    const schema = await gw.getEnvSchema();
    expect(schema.keys[0]?.key).toBe("DNSCRYPT_PROXY_ENABLED");
    const cfg = await gw.getEnvConfig();
    expect(cfg.effective.DNSCRYPT_PROXY_ENABLED).toBe("0");
  });

  it("applyEnvConfig accepts 200 applied when host apply runs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          kind: "applied",
          policy_ref: "ADR-0053",
          mutation: "mutations.env.apply",
          summary: "Tier-1 .env changes applied on the host.",
          backup_path: "/opt/pihole-ha/.env.bak.1",
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const res = await gw.applyEnvConfig("secret");
    expect(res.applied).toBe(true);
    expect(res.summary).toContain("applied");
    expect(res.backupPath).toContain(".env.bak");
  });

  it("applyEnvConfig accepts 202 host_action_required", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 202,
        json: async () => ({
          kind: "host_action_required",
          policy_ref: "ADR-0053",
          mutation: "mutations.env.apply",
          summary: "Run script",
          next_steps: { scripts: ["/usr/local/bin/pihole-ha-apply-env-patch.sh"] },
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const res = await gw.applyEnvConfig("secret");
    expect(res.status).toBe(202);
    expect(res.summary).toContain("Run");
  });

  it("rollbackEnvConfig accepts 200 applied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          kind: "applied",
          policy_ref: "ADR-0053",
          mutation: "mutations.env.rollback",
          summary: "Restored the latest .env backup on the host.",
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const res = await gw.rollbackEnvConfig("secret");
    expect(res.applied).toBe(true);
    expect(res.summary).toContain("Restored");
  });

  it("rollbackEnvConfig accepts 202", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 202,
        json: async () => ({
          kind: "host_action_required",
          policy_ref: "ADR-0053",
          mutation: "mutations.env.rollback",
          summary: "Rollback",
          next_steps: { scripts: ["/usr/local/bin/pihole-ha-apply-env-patch.sh"], example: "sudo x" },
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const res = await gw.rollbackEnvConfig("secret");
    expect(res.example).toBe("sudo x");
  });

  it("patchEnvConfig surfaces FastAPI detail on 403 instead of invalid shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ detail: "Mutation denied." }),
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.patchEnvConfig({ DNSCRYPT_PROXY_ENABLED: "1" }, "bad")).rejects.toMatchObject({
      code: "http_error",
      status: 403,
      message: "Mutation denied.",
    });
  });

  it("patchEnvConfig throws http_error when response shape is valid but status is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ staged: {}, pending: null }),
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.patchEnvConfig({ DNSCRYPT_PROXY_ENABLED: "1" }, "bad")).rejects.toMatchObject({
      code: "http_error",
      status: 403,
    });
  });

  it("patchEnvConfig throws parse_failed when JSON does not match env patch schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ detail: "not a patch response" }),
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.patchEnvConfig({ DNSCRYPT_PROXY_ENABLED: "1" }, "secret")).rejects.toMatchObject({
      code: "parse_failed",
    });
  });

  it("patchEnvConfig throws parse_failed when body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 202,
        json: async () => {
          throw new Error("not json");
        },
      })),
    );
    const gw = new PiholeCpGateway("");
    await expect(gw.patchEnvConfig({ DNSCRYPT_PROXY_ENABLED: "1" }, "secret")).rejects.toMatchObject({
      code: "parse_failed",
    });
  });

  it("getMeta throws parse_failed when body is not JSON", async () => {
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
    await expect(gw.getMeta()).rejects.toMatchObject({
      code: "parse_failed",
      message: expect.stringContaining("GET"),
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
