import type {
  DhcpClientListResponse,
  DhcpPoolListResponse,
  DhcpReservationListResponse,
  DiscoveryRecordListResponse,
  MetaResponse,
  PerfSummaryResponse,
  PluginListResponse,
} from "./api/types";

export class DataGateway {
  constructor(private readonly baseUrl = "") {}

  private async getJson<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  getMeta(): Promise<MetaResponse> {
    return this.getJson<MetaResponse>("/api/v1/meta");
  }

  listPlugins(): Promise<PluginListResponse> {
    return this.getJson<PluginListResponse>("/api/v1/plugins");
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

  getPerfSummary(): Promise<PerfSummaryResponse> {
    return this.getJson<PerfSummaryResponse>("/api/v1/perf/summary");
  }
}
