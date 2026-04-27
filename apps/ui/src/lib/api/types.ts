/** Mirrors specs/api/openapi.yaml (subset used by the shell). */

export type HostControl = "single-panel" | "tab-control" | "vertical-stack" | "split-grid";

export type DisplayMode = "compact" | "full";

export type TileDisplayStyle = "gauge" | "percent_only";

/** How perf semicircle fills blend threshold colours along the arc. */
export type GaugeGradientMode = "smooth" | "banded";

export interface TileOptions {
  /** `true` = single combined CPU gauge (“Show as total”); omitted/false = per-core (default). */
  cpu_total?: boolean;
  network_by_adapter?: boolean;
  disk_by_volume?: boolean;
  display_style?: TileDisplayStyle;
  /**
   * `smooth` (default): continuous gradient across green→amber→orange→red zones.
   * `banded`: discrete colour segments (legacy look).
   */
  gauge_gradient_mode?: GaugeGradientMode;
  /** Max dashboard columns for this perf tile; gauges wrap inside when count exceeds this (1–12). */
  perf_max_cols?: number;
}

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

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  checked_at: string;
  dependencies?: { name: string; status: "ok" | "degraded" | "down"; detail?: string | null }[];
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
  client_category?: string | null;
  vendor_name?: string | null;
  scan_status?: string | null;
  lease_started_at?: string | null;
  lease_expires_at?: string | null;
  subnet_cidr?: string | null;
  services?: string[];
}

export interface DhcpClientListResponse {
  items: DhcpClient[];
}

export interface DhcpClientPatch {
  hostname?: string | null;
  vendor_name?: string | null;
}

export interface DhcpReservation {
  id: string;
  hardware_address: string;
  reserved_address: string;
  hostname?: string | null;
  category?: string | null;
  subnet_cidr?: string | null;
  vendor_name?: string | null;
  scan_status?: string | null;
  services?: string[];
}

export interface DhcpReservationListResponse {
  items: DhcpReservation[];
}

export interface DhcpReservationPatch {
  hardware_address?: string;
  reserved_address?: string;
  hostname?: string | null;
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

export interface DiscoveryScanResponse {
  state: "idle" | "running" | "paused" | "failed";
  updated_at: string;
  record_count?: number | null;
}

export interface NetworkAdapterSample {
  name: string;
  in_mbps: number;
  out_mbps: number;
}

export interface DiskVolumeSample {
  label: string;
  used_percent: number;
}

export interface PerfSummaryResponse {
  cpu_percent_total: number;
  cpu_core_percent?: number[];
  memory_used_percent: number;
  memory_used_bytes?: number | null;
  memory_total_bytes?: number | null;
  network_in_mbps?: number | null;
  network_out_mbps?: number | null;
  network_adapters?: NetworkAdapterSample[];
  disk_used_percent?: number | null;
  disk_volumes?: DiskVolumeSample[];
  collected_at: string;
}

export interface FabricEvent {
  topic: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export type LogLevel = "CRITICAL" | "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

export interface AdminLogRecord {
  ts: string;
  level: LogLevel;
  event: string;
  message: string;
  service: string;
  operation: string;
  subcategory: string;
  mode?: string | null;
  request_id?: string | null;
  trace_id?: string | null;
  actor?: string | null;
  error_type?: string | null;
  error_message?: string | null;
}

export interface AdminLogsResponse {
  items: AdminLogRecord[];
  cursor?: number;
  page_size?: number;
  next_cursor?: number | null;
  total_count?: number;
  total_pages?: number;
}
