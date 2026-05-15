import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardLayoutV3 } from "../dashboard/types";
import { PiholeCpDashboardGateway } from "./PiholeCpDashboardGateway";

const emptyLayout: DashboardLayoutV3 = { version: 3, items: [] };

describe("PiholeCpDashboardGateway", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("putDashboardLayout resolves without calling Kea APIs", async () => {
    const gw = new PiholeCpDashboardGateway();
    await expect(gw.putDashboardLayout("pihole-cp", emptyLayout)).resolves.toBeUndefined();
  });

  it("postDashboardLayoutSaveFile resolves with a local filename", async () => {
    const gw = new PiholeCpDashboardGateway();
    await expect(gw.postDashboardLayoutSaveFile("pihole-cp", emptyLayout)).resolves.toEqual({
      filename: "pihole-cp-local.json",
    });
  });

  it("resetDashboardLayout rejects (no Kea reset in this bundle)", async () => {
    const gw = new PiholeCpDashboardGateway();
    await expect(gw.resetDashboardLayout("pihole-cp")).rejects.toThrow(/not available/);
  });

  it("getPerfSummary loads node perf from the control plane", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | Request) => {
        const u = typeof input === "string" ? input : input.url;
        expect(u).toContain("/v1/node/perf/summary");
        return new Response(
          JSON.stringify({
            cpu_percent_total: 7.5,
            memory_used_percent: 22,
            disk_used_percent: 33,
            disk_volumes: [{ label: "/", used_percent: 33 }],
            collected_at: "2026-01-01T00:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    const gw = new PiholeCpDashboardGateway("http://192.0.2.1:8091");
    const p = await gw.getPerfSummary();
    expect(p.cpu_percent_total).toBe(7.5);
    expect(p.memory_used_percent).toBe(22);
  });

  it("getPerfSummary throws on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const gw = new PiholeCpDashboardGateway("");
    await expect(gw.getPerfSummary()).rejects.toMatchObject({ code: "http_error", status: 503 });
  });

  it("getPerfSummary throws on non-JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x", { status: 200, headers: { "Content-Type": "text/plain" } })),
    );
    const gw = new PiholeCpDashboardGateway("");
    await expect(gw.getPerfSummary()).rejects.toMatchObject({ code: "parse_failed" });
  });

  it("getPerfSummary throws on Zod validation failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const gw = new PiholeCpDashboardGateway("");
    await expect(gw.getPerfSummary()).rejects.toMatchObject({ code: "parse_failed" });
  });
});
