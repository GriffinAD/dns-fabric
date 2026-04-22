/**
 * OpenAPI-shaped fixtures for dev and tests. Kept in sync with specs/api/openapi.yaml.
 */

export const mockRoutes: Record<string, unknown> = {
  "/api/v1/meta": {
    api_version: "1.0.0",
    service: "kea-fabric",
    dashboard_embed_auth: "none",
  },
  "/api/v1/plugins": {
    items: [
      {
        id: "dhcp.pools",
        name: "DHCP pools",
        enabled: true,
        ui_dashboard: {
          allowed_host_controls: ["single-panel", "tab-control", "vertical-stack", "split-grid"],
          default_size_hint: "md",
          min_size: null,
          max_size: null,
          compact_min_footprint: "200x120",
          supports_compact: true,
          supports_full: true,
        },
      },
      {
        id: "dhcp.clients",
        name: "DHCP clients",
        enabled: true,
        ui_dashboard: {
          allowed_host_controls: ["single-panel", "tab-control", "vertical-stack", "split-grid"],
          default_size_hint: "lg",
          min_size: null,
          max_size: null,
          compact_min_footprint: "240x160",
          supports_compact: true,
          supports_full: true,
        },
      },
      {
        id: "dhcp.reservations",
        name: "Static reservations",
        enabled: true,
        ui_dashboard: {
          allowed_host_controls: ["single-panel", "vertical-stack"],
          default_size_hint: "md",
          min_size: null,
          max_size: null,
          compact_min_footprint: "200x120",
          supports_compact: true,
          supports_full: true,
        },
      },
      {
        id: "discovery.records",
        name: "Discovery",
        enabled: true,
        ui_dashboard: {
          allowed_host_controls: ["single-panel", "tab-control"],
          default_size_hint: "lg",
          min_size: null,
          max_size: null,
          compact_min_footprint: "280x140",
          supports_compact: true,
          supports_full: true,
        },
      },
      {
        id: "perf.summary",
        name: "Performance",
        enabled: true,
        ui_dashboard: {
          allowed_host_controls: ["single-panel", "vertical-stack"],
          default_size_hint: "sm",
          min_size: null,
          max_size: null,
          compact_min_footprint: "160x100",
          supports_compact: true,
          supports_full: true,
        },
      },
    ],
  },
  "/api/v1/dhcp/pools": {
    items: [
      {
        id: "pool-default",
        subnet_cidr: "192.0.2.0/24",
        range_start: "192.0.2.100",
        range_end: "192.0.2.199",
        dns_domain: "example.test",
      },
    ],
  },
  "/api/v1/dhcp/clients": {
    items: [
      {
        id: "cli-1",
        hardware_address: "52:54:00:ab:cd:ef",
        assigned_address: "192.0.2.110",
        pool_id: "pool-default",
        hostname: "test-host",
        lease_expires_at: "2026-04-23T12:00:00Z",
      },
    ],
  },
  "/api/v1/dhcp/reservations": {
    items: [
      {
        id: "res-1",
        hardware_address: "52:54:00:11:22:33",
        reserved_address: "192.0.2.50",
        hostname: "reserved",
      },
    ],
  },
  "/api/v1/discovery/records": {
    items: [
      {
        id: "disc-1",
        last_seen_at: "2026-04-22T10:00:00Z",
        state: "active",
        addresses: ["192.0.2.88"],
        labels: { vendor: "lab" },
      },
    ],
  },
  "/api/v1/perf/summary": {
    cpu_percent_total: 24.5,
    memory_used_percent: 61.0,
    network_in_mbps: 12.3,
    network_out_mbps: 4.1,
    disk_used_percent: 44.0,
    collected_at: "2026-04-22T10:05:00Z",
  },
};
