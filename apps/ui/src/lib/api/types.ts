/** Mirrors specs/api/openapi.yaml (subset used by the shell). */

export type HostControl = "single-panel" | "tab-control" | "vertical-stack" | "split-grid";

export type DisplayMode = "compact" | "full";

export interface MetaResponse {
  api_version: string;
  service: string;
  dashboard_embed_auth?: "none" | "signed";
}

export interface UiDashboardManifest {
  allowed_host_controls: HostControl[];
  default_size_hint: string;
  min_size: string | null;
  max_size: string | null;
  compact_min_footprint: string | null;
  supports_compact: boolean;
  supports_full: boolean;
}

export interface PluginEntry {
  id: string;
  name: string;
  enabled: boolean;
  ui_dashboard?: UiDashboardManifest;
}

export interface PluginListResponse {
  items: PluginEntry[];
}

export interface DhcpPool {
  id: string;
  subnet_cidr: string;
  range_start: string;
  range_end: string;
  dns_domain?: string | null;
}

export interface DhcpPoolListResponse {
  items: DhcpPool[];
}

export interface DhcpClient {
  id: string;
  hardware_address: string;
  assigned_address: string;
  pool_id: string;
  hostname?: string | null;
  lease_expires_at?: string | null;
}

export interface DhcpClientListResponse {
  items: DhcpClient[];
}

export interface DhcpReservation {
  id: string;
  hardware_address: string;
  reserved_address: string;
  hostname?: string | null;
}

export interface DhcpReservationListResponse {
  items: DhcpReservation[];
}

export interface DiscoveryRecord {
  id: string;
  last_seen_at: string;
  state: "active" | "stale" | "lost";
  addresses?: string[];
  labels?: Record<string, string>;
}

export interface DiscoveryRecordListResponse {
  items: DiscoveryRecord[];
}

export interface PerfSummaryResponse {
  cpu_percent_total: number;
  memory_used_percent: number;
  network_in_mbps?: number | null;
  network_out_mbps?: number | null;
  disk_used_percent?: number | null;
  collected_at: string;
}
