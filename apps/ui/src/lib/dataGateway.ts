import { z } from "zod";

import {
  dhcpClientListResponseSchema,
  dhcpClientSchema,
  dhcpPoolListResponseSchema,
  dhcpReservationSchema,
  dhcpReservationListResponseSchema,
  discoveryRecordListResponseSchema,
  discoveryScanResponseSchema,
  dashboardLayoutSaveFileResponseSchema,
  fabricEventSchema,
  healthResponseSchema,
  metaResponseSchema,
  perfSummaryResponseSchema,
  pluginListResponseSchema,
} from "./api/openapiZod";
import { dashboardLayoutJsonSchema, normalizeLayoutFromJson } from "./dashboard/layoutZod";
import type {
  DhcpClientListResponse,
  DhcpClientPatch,
  DhcpClient,
  DhcpPoolListResponse,
  DhcpReservationListResponse,
  DhcpReservationPatch,
  DhcpReservation,
  DiscoveryRecordListResponse,
  DiscoveryScanResponse,
  FabricEvent,
  HealthResponse,
  MetaResponse,
  PerfSummaryResponse,
  PluginListResponse,
} from "./api/types";
import type { DashboardLayout } from "./dashboard/types";

export type GatewayErrorCode = "http_error" | "parse_failed";

/** Typed failure from `DataGateway` (HTTP or response shape). See `docs/planning/UI_ENGINE_PLAN.md` P3.4. */
export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly path: string;
  readonly status?: number;
  readonly zodError?: z.ZodError;

  constructor(init: {
    code: GatewayErrorCode;
    path: string;
    message: string;
    status?: number;
    zodError?: z.ZodError;
  }) {
    super(init.message);
    this.name = "GatewayError";
    this.code = init.code;
    this.path = init.path;
    this.status = init.status;
    this.zodError = init.zodError;
  }
}

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

  private async getJsonValidated<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(this.url(path), { headers: { ...this.authHeaders() } });
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
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      console.warn(`[DataGateway] Zod parse failed for ${path}`, parsed.error.flatten());
      throw new GatewayError({
        code: "parse_failed",
        path,
        message: `Invalid response shape for ${path}`,
        zodError: parsed.error,
      });
    }
    return parsed.data;
  }

  private async putJson(path: string, body: unknown): Promise<void> {
    const res = await fetch(this.url(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new GatewayError({
        code: "http_error",
        path,
        message: `PUT ${path} failed: ${res.status} ${res.statusText}`,
        status: res.status,
      });
    }
  }

  private async postJsonValidated<T>(path: string, reqBody: unknown, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(this.url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(reqBody),
    });
    if (!res.ok) {
      throw new GatewayError({
        code: "http_error",
        path,
        message: `POST ${path} failed: ${res.status} ${res.statusText}`,
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
        message: `POST ${path} returned non-JSON`,
      });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      console.warn(`[DataGateway] Zod parse failed for ${path}`, parsed.error.flatten());
      throw new GatewayError({
        code: "parse_failed",
        path,
        message: `Invalid response shape for ${path}`,
        zodError: parsed.error,
      });
    }
    return parsed.data;
  }

  private async patchJsonValidated<T>(path: string, reqBody: unknown, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(this.url(path), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(reqBody),
    });
    if (!res.ok) {
      throw new GatewayError({
        code: "http_error",
        path,
        message: `PATCH ${path} failed: ${res.status} ${res.statusText}`,
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
        message: `PATCH ${path} returned non-JSON`,
      });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      console.warn(`[DataGateway] Zod parse failed for ${path}`, parsed.error.flatten());
      throw new GatewayError({
        code: "parse_failed",
        path,
        message: `Invalid response shape for ${path}`,
        zodError: parsed.error,
      });
    }
    return parsed.data;
  }

  getHealth(): Promise<HealthResponse> {
    return this.getJsonValidated("/api/v1/health", healthResponseSchema);
  }

  getMeta(): Promise<MetaResponse> {
    return this.getJsonValidated("/api/v1/meta", metaResponseSchema);
  }

  listPlugins(): Promise<PluginListResponse> {
    return this.getJsonValidated("/api/v1/plugins", pluginListResponseSchema);
  }

  async getDashboardLayout(dashboardId: string): Promise<DashboardLayout> {
    const path = `/api/v1/dashboards/${encodeURIComponent(dashboardId)}/layout`;
    const raw = await this.getJsonValidated(path, dashboardLayoutJsonSchema);
    return normalizeLayoutFromJson(raw);
  }

  putDashboardLayout(dashboardId: string, layout: DashboardLayout): Promise<void> {
    return this.putJson(`/api/v1/dashboards/${encodeURIComponent(dashboardId)}/layout`, layout);
  }

  /** Persists layout server-side and writes ``Dashboard_Layout_<timestamp>.json`` under ``dashboard-layout-exports/``. */
  postDashboardLayoutSaveFile(
    dashboardId: string,
    layout: DashboardLayout,
  ): Promise<{ filename: string }> {
    const path = `/api/v1/dashboards/${encodeURIComponent(dashboardId)}/layout/save-file`;
    return this.postJsonValidated(path, layout, dashboardLayoutSaveFileResponseSchema);
  }

  /** Restores layout from ``dashboard-layouts.orig.json`` (server never writes that file). */
  async resetDashboardLayout(dashboardId: string): Promise<DashboardLayout> {
    const path = `/api/v1/dashboards/${encodeURIComponent(dashboardId)}/layout/reset`;
    const res = await fetch(this.url(path), {
      method: "POST",
      headers: { ...this.authHeaders() },
    });
    if (!res.ok) {
      throw new GatewayError({
        code: "http_error",
        path,
        message: `POST ${path} failed: ${res.status} ${res.statusText}`,
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
        message: `POST ${path} returned non-JSON`,
      });
    }
    const parsed = dashboardLayoutJsonSchema.safeParse(body);
    if (!parsed.success) {
      console.warn(`[DataGateway] Zod parse failed for ${path}`, parsed.error.flatten());
      throw new GatewayError({
        code: "parse_failed",
        path,
        message: `Invalid response shape for ${path}`,
        zodError: parsed.error,
      });
    }
    return normalizeLayoutFromJson(parsed.data);
  }

  listDhcpPools(): Promise<DhcpPoolListResponse> {
    return this.getJsonValidated("/api/v1/dhcp/pools", dhcpPoolListResponseSchema);
  }

  listDhcpClients(): Promise<DhcpClientListResponse> {
    return this.getJsonValidated("/api/v1/dhcp/clients", dhcpClientListResponseSchema);
  }

  listDhcpReservations(): Promise<DhcpReservationListResponse> {
    return this.getJsonValidated("/api/v1/dhcp/reservations", dhcpReservationListResponseSchema);
  }

  patchDhcpClient(clientId: string, patch: DhcpClientPatch): Promise<DhcpClient> {
    return this.patchJsonValidated(
      `/api/v1/dhcp/clients/${encodeURIComponent(clientId)}`,
      patch,
      dhcpClientSchema,
    );
  }

  patchDhcpReservation(reservationId: string, patch: DhcpReservationPatch): Promise<DhcpReservation> {
    return this.patchJsonValidated(
      `/api/v1/dhcp/reservations/${encodeURIComponent(reservationId)}`,
      patch,
      dhcpReservationSchema,
    );
  }

  listDiscoveryRecords(): Promise<DiscoveryRecordListResponse> {
    return this.getJsonValidated("/api/v1/discovery/records", discoveryRecordListResponseSchema);
  }

  getDiscoveryScan(): Promise<DiscoveryScanResponse> {
    return this.getJsonValidated("/api/v1/discovery/scan", discoveryScanResponseSchema);
  }

  pauseDiscoveryScan(paused: boolean): Promise<DiscoveryScanResponse> {
    return this.postJsonValidated("/api/v1/discovery/scan/pause", { paused }, discoveryScanResponseSchema);
  }

  getPerfSummary(): Promise<PerfSummaryResponse> {
    return this.getJsonValidated("/api/v1/perf/summary", perfSummaryResponseSchema);
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
        const raw = JSON.parse(ev.data) as unknown;
        const parsed = fabricEventSchema.safeParse(raw);
        if (!parsed.success) {
          console.warn("[DataGateway] invalid SSE payload", parsed.error.flatten());
          onError?.("invalid event payload");
          return;
        }
        onEvent(parsed.data as FabricEvent);
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
