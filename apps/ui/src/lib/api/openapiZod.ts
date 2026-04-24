/**
 * Zod schemas mirroring specs/api/openapi.yaml for fail-fast mock/fixture checks.
 * Keep in sync when OpenAPI changes.
 */
import { z } from "zod";

const hostControl = z.enum(["single-panel", "tab-control", "vertical-stack", "split-grid"]);

const uiDashboardManifest = z
  .object({
    allowed_host_controls: z.array(hostControl),
    default_size_hint: z.string(),
    min_size: z.string().nullable(),
    max_size: z.string().nullable(),
    compact_min_footprint: z.string().nullable(),
    supports_compact: z.boolean(),
    supports_full: z.boolean(),
  })
  .strict();

const pluginEntry = z
  .object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    ui_dashboard: uiDashboardManifest.optional(),
  })
  .strict();

export const healthResponseSchema = z
  .object({
    status: z.enum(["ok", "degraded", "down"]),
    checked_at: z.string(),
    dependencies: z
      .array(
        z
          .object({
            name: z.string(),
            status: z.enum(["ok", "degraded", "down"]),
            detail: z.string().nullable().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const metaResponseSchema = z
  .object({
    api_version: z.string(),
    service: z.string(),
    dashboard_embed_auth: z.enum(["none", "signed"]).optional(),
  })
  .strict();

export const pluginListResponseSchema = z
  .object({
    items: z.array(pluginEntry),
  })
  .strict();

export const dhcpPoolListResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string(),
          subnet_cidr: z.string(),
          range_start: z.string(),
          range_end: z.string(),
          dns_domain: z.string().nullable().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const dhcpClientListResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string(),
          hardware_address: z.string(),
          assigned_address: z.string(),
          pool_id: z.string(),
          hostname: z.string().nullable().optional(),
          client_category: z.string().nullable().optional(),
          vendor_name: z.string().nullable().optional(),
          scan_status: z.string().nullable().optional(),
          lease_started_at: z.string().nullable().optional(),
          lease_expires_at: z.string().nullable().optional(),
          subnet_cidr: z.string().nullable().optional(),
          services: z.array(z.string()).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const dhcpReservationListResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string(),
          hardware_address: z.string(),
          reserved_address: z.string(),
          hostname: z.string().nullable().optional(),
          category: z.string().nullable().optional(),
          subnet_cidr: z.string().nullable().optional(),
          vendor_name: z.string().nullable().optional(),
          scan_status: z.string().nullable().optional(),
          services: z.array(z.string()).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const discoveryRecordListResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string(),
          last_seen_at: z.string(),
          state: z.enum(["active", "stale", "lost"]),
          addresses: z.array(z.string()).optional(),
          labels: z.record(z.string()).optional(),
        })
        .strict(),
    ),
  })
  .strict();

const networkAdapterSample = z
  .object({
    name: z.string(),
    in_mbps: z.number(),
    out_mbps: z.number(),
  })
  .strict();

const diskVolumeSample = z
  .object({
    label: z.string(),
    used_percent: z.number(),
  })
  .strict();

export const discoveryScanResponseSchema = z
  .object({
    state: z.enum(["idle", "running", "paused"]),
    updated_at: z.string(),
    record_count: z.number().nullable().optional(),
  })
  .strict();

/** SSE `data:` payloads on `/api/v1/events/stream`. */
export const fabricEventSchema = z
  .object({
    topic: z.string(),
    occurred_at: z.string(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export const perfSummaryResponseSchema = z
  .object({
    cpu_percent_total: z.number(),
    cpu_core_percent: z.array(z.number()).optional(),
    memory_used_percent: z.number(),
    memory_used_bytes: z.number().nullable().optional(),
    memory_total_bytes: z.number().nullable().optional(),
    network_in_mbps: z.number().nullable().optional(),
    network_out_mbps: z.number().nullable().optional(),
    network_adapters: z.array(networkAdapterSample).optional(),
    disk_used_percent: z.number().nullable().optional(),
    disk_volumes: z.array(diskVolumeSample).optional(),
    collected_at: z.string(),
  })
  .strict();

/** GET /api/v1/* JSON bodies served from baseFixtures (dev mocks). */
export const mockFixtureSchemas: Record<string, z.ZodType<unknown>> = {
  "/api/v1/health": healthResponseSchema,
  "/api/v1/meta": metaResponseSchema,
  "/api/v1/plugins": pluginListResponseSchema,
  "/api/v1/dhcp/pools": dhcpPoolListResponseSchema,
  "/api/v1/dhcp/clients": dhcpClientListResponseSchema,
  "/api/v1/dhcp/reservations": dhcpReservationListResponseSchema,
  "/api/v1/discovery/records": discoveryRecordListResponseSchema,
  "/api/v1/perf/summary": perfSummaryResponseSchema,
};

export function parseMockFixture(path: string, body: unknown): unknown {
  const schema = mockFixtureSchemas[path];
  if (!schema) {
    throw new Error(`No Zod schema registered for fixture path: ${path}`);
  }
  return schema.parse(body);
}
