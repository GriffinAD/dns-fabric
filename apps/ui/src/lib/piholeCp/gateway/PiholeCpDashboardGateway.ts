import { perfSummaryResponseSchema } from "../../api/openapiZod";
import type { PerfSummaryResponse } from "../../api/types";
import type { DashboardLayout } from "../../dashboard/types";
import { DataGateway, GatewayError } from "../../dataGateway";
import { joinControlPlaneUrl } from "../gateway/PiholeCpGateway";

/**
 * Layout persistence no-op gateway for the Pi-hole CP bundle: `DashboardPage` / `layoutStore`
 * expect a `DataGateway`, but this workspace has no Kea layout API.
 *
 * **Perf** (`getPerfSummary`) reads **`GET /v1/node/perf/summary`** on the control plane so gauges
 * reflect this Pi. Kea Fabric (`setKeaFabricApiBaseUrl`) remains for DHCP, discovery, and fabric SSE.
 */
export class PiholeCpDashboardGateway extends DataGateway {
  private readonly controlPlaneBaseUrl: string;

  constructor(controlPlaneBaseUrl = "") {
    super("", {});
    this.controlPlaneBaseUrl = controlPlaneBaseUrl.trim();
  }

  override putDashboardLayout(_dashboardId: string, _layout: DashboardLayout): Promise<void> {
    return Promise.resolve();
  }

  override postDashboardLayoutSaveFile(
    _dashboardId: string,
    _layout: DashboardLayout,
  ): Promise<{ filename: string }> {
    return Promise.resolve({ filename: "pihole-cp-local.json" });
  }

  override async resetDashboardLayout(_dashboardId: string): Promise<DashboardLayout> {
    void _dashboardId;
    throw new GatewayError({
      code: "http_error",
      path: "/api/v1/dashboards/pihole-cp/layout/reset",
      message: "Dashboard layout reset is not available in the Pi-hole control plane UI.",
    });
  }

  override async getPerfSummary(): Promise<PerfSummaryResponse> {
    const path = "/v1/node/perf/summary";
    const url = joinControlPlaneUrl(this.controlPlaneBaseUrl, path);
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new GatewayError({
        code: "http_error",
        path,
        message: `GET ${path} failed: ${res.status} ${res.statusText}`,
        status: res.status,
      });
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new GatewayError({
        code: "parse_failed",
        path,
        message: `GET ${path} returned non-JSON`,
      });
    }
    const parsed = perfSummaryResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new GatewayError({
        code: "parse_failed",
        path,
        message: `Invalid response shape for ${path}`,
        zodError: parsed.error,
      });
    }
    return parsed.data;
  }
}
