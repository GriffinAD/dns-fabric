import type {
  DhcpClientListResponse,
  DhcpPoolListResponse,
  DhcpReservationListResponse,
  DiscoveryRecordListResponse,
  DiscoveryScanResponse,
  FabricEvent,
  HealthResponse,
  MetaResponse,
  PerfSummaryResponse,
  PluginListResponse,
} from "./api/types";
import type { DashboardLayout } from "./dashboard/types";

export type DataGatewayOptions = {
  /** Bearer token for operator/viewer (never commit real secrets; use .env.local). */
  authToken?: string;
};

export class DataGateway {
  private readonly resolvedBaseUrl: string;
  private readonly authToken: string | undefined;

  constructor(baseUrl = "", options?: DataGatewayOptions) {
    const envBase = import.meta.env.VITE_API_BASE_URL;
    this.resolvedBaseUrl = baseUrl || (typeof envBase === "string" ? envBase : "");
    const envTok = import.meta.env.VITE_API_AUTH_TOKEN;
    this.authToken = options?.authToken ?? (typeof envTok === "string" ? envTok : undefined);
  }

  private url(path: string): string {
    return `${this.resolvedBaseUrl}${path}`;
  }

  private authHeaders(): Record<string, string> {
    if (!this.authToken) {
      return {};
    }
    return { Authorization: `Bearer ${this.authToken}` };
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(this.url(path), { headers: { ...this.authHeaders() } });
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  private async putJson(path: string, body: unknown): Promise<void> {
    const res = await fetch(this.url(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`PUT ${path} failed: ${res.status} ${res.statusText}`);
    }
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  getHealth(): Promise<HealthResponse> {
    return this.getJson<HealthResponse>("/api/v1/health");
  }

  getMeta(): Promise<MetaResponse> {
    return this.getJson<MetaResponse>("/api/v1/meta");
  }

  listPlugins(): Promise<PluginListResponse> {
    return this.getJson<PluginListResponse>("/api/v1/plugins");
  }

  getDashboardLayout(dashboardId: string): Promise<DashboardLayout> {
    return this.getJson<DashboardLayout>(`/api/v1/dashboards/${encodeURIComponent(dashboardId)}/layout`);
  }

  putDashboardLayout(dashboardId: string, layout: DashboardLayout): Promise<void> {
    return this.putJson(`/api/v1/dashboards/${encodeURIComponent(dashboardId)}/layout`, layout);
  }

  listDhcpPools(): Promise<DhcpPoolListResponse> {
    return this.getJson<DhcpPoolListResponse>("/api/v1/dhcp/pools");
  }

  listDhcpClients(): Promise<DhcpClientListResponse> {
    return this.getJson<DhcpClientListResponse>("/api/v1/dhcp/clients");
  }

  listDhcpReservations(): Promise<DhcpReservationListResponse> {
    return this.getJson<DhcpReservationListResponse>("/api/v1/dhcp/reservations");
  }

  listDiscoveryRecords(): Promise<DiscoveryRecordListResponse> {
    return this.getJson<DiscoveryRecordListResponse>("/api/v1/discovery/records");
  }

  getDiscoveryScan(): Promise<DiscoveryScanResponse> {
    return this.getJson<DiscoveryScanResponse>("/api/v1/discovery/scan");
  }

  pauseDiscoveryScan(paused: boolean): Promise<DiscoveryScanResponse> {
    return this.postJson<DiscoveryScanResponse>("/api/v1/discovery/scan/pause", { paused });
  }

  getPerfSummary(): Promise<PerfSummaryResponse> {
    return this.getJson<PerfSummaryResponse>("/api/v1/perf/summary");
  }

  /**
   * Subscribe to SSE fabric events. Returns unsubscribe. No-op if EventSource is missing (SSR/tests).
   * When `authToken` is set, passes `access_token` query (EventSource cannot set headers).
   */
  subscribeFabricEvents(onEvent: (event: FabricEvent) => void, onError?: (message: string) => void): () => void {
    if (typeof EventSource === "undefined") {
      return () => {};
    }
    let streamPath = "/api/v1/events/stream";
    if (this.authToken) {
      const q = new URLSearchParams({ access_token: this.authToken });
      streamPath = `${streamPath}?${q.toString()}`;
    }
    const es = new EventSource(this.url(streamPath));
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as FabricEvent;
        onEvent(parsed);
      } catch {
        onError?.("invalid event payload");
      }
    };
    es.onerror = () => {
      onError?.("event source error");
    };
    return () => es.close();
  }
}
