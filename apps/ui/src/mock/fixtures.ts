/**
 * Baseline OpenAPI-shaped fixtures. Handler may override per request (empty/error, PUT layout).
 * Table lists and perf tick 0 are built once (simulate mode: stable inventory, live perf via SSE).
 */

import { buildDefaultPool, buildDhcpClientItems, buildDhcpReservationItems, buildDiscoveryRecordItems } from "./generateTableFixtures";
import { MOCK_T0_ISO } from "./mockConstants";
import { perfSummaryForTick } from "./perfSimulate";

export const baseFixtures: Record<string, unknown> = {
  "/api/v1/health": {
    status: "ok",
    checked_at: MOCK_T0_ISO,
    dependencies: [{ name: "api", status: "ok", detail: null }],
  },
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
        id: "perf.cpu",
        name: "CPU",
        enabled: true,
        ui_dashboard: {
          allowed_host_controls: ["single-panel", "vertical-stack"],
          default_size_hint: "sm",
          min_size: null,
          max_size: null,
          compact_min_footprint: "120x80",
          supports_compact: true,
          supports_full: true,
        },
      },
      {
        id: "perf.ram",
        name: "Memory",
        enabled: true,
        ui_dashboard: {
          allowed_host_controls: ["single-panel", "vertical-stack"],
          default_size_hint: "sm",
          min_size: null,
          max_size: null,
          compact_min_footprint: "100x100",
          supports_compact: true,
          supports_full: true,
        },
      },
      {
        id: "perf.network",
        name: "Network",
        enabled: true,
        ui_dashboard: {
          allowed_host_controls: ["single-panel", "vertical-stack"],
          default_size_hint: "sm",
          min_size: null,
          max_size: null,
          compact_min_footprint: "120x80",
          supports_compact: true,
          supports_full: true,
        },
      },
      {
        id: "perf.disk",
        name: "Disk",
        enabled: true,
        ui_dashboard: {
          allowed_host_controls: ["single-panel", "vertical-stack"],
          default_size_hint: "sm",
          min_size: null,
          max_size: null,
          compact_min_footprint: "120x80",
          supports_compact: true,
          supports_full: true,
        },
      },
      {
        id: "perf.summary",
        name: "Performance (legacy)",
        enabled: false,
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
    items: [buildDefaultPool()],
  },
  "/api/v1/dhcp/clients": {
    items: buildDhcpClientItems(),
  },
  "/api/v1/dhcp/reservations": {
    items: buildDhcpReservationItems(),
  },
  "/api/v1/discovery/records": {
    items: buildDiscoveryRecordItems(),
  },
  "/api/v1/perf/summary": perfSummaryForTick(0),
};
