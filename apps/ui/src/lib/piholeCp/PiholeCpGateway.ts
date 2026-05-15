import { z, type ZodType } from "zod";

import { GatewayError } from "../dataGateway";
import {
  envConfigResponseSchema,
  envPatchResponseSchema,
  envSchemaResponseSchema,
  hostActionResponseSchema,
  type EnvConfigResponse,
  type EnvSchemaEntry,
} from "./envConfigZod";
import {
  dashboardResponseSchema,
  logsCatalogResponseSchema,
  metaResponseSchema,
  type DashboardResponse,
  type LogsCatalogResponse,
} from "./dashboardZod";

export type PiholeCpMeta = {
  peer_ui_base_url: string | null;
  node: string;
  kea_fabric_api_base_url: string | null;
  /** From `DHCP_MODE` on the node; `kea` means Kea DHCP tiles are offered in the embedded UI. */
  dhcp_mode: string | null;
};

/** Join control-plane base URL with an API path (leading `/` optional). Exported for unit tests. */
export function joinControlPlaneUrl(baseUrl: string, path: string): string {
  const b = baseUrl.replace(/\/$/, "");
  return `${b}${path.startsWith("/") ? path : `/${path}`}`;
}

export class PiholeCpGateway {
  constructor(private readonly baseUrl: string) {}

  private url(path: string): string {
    return joinControlPlaneUrl(this.baseUrl, path);
  }

  private async getJsonValidated<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(this.url(path), {
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
    const parsed = schema.safeParse(body);
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

  async getDashboard(): Promise<DashboardResponse> {
    return this.getJsonValidated("/dashboard", dashboardResponseSchema);
  }

  async getLogsCatalog(): Promise<LogsCatalogResponse> {
    return this.getJsonValidated("/logs/catalog", logsCatalogResponseSchema);
  }

  async getMeta(): Promise<PiholeCpMeta> {
    const m = await this.getJsonValidated("/v1/meta", metaResponseSchema);
    return {
      peer_ui_base_url: m.peer_ui_base_url ?? null,
      node: m.node ?? "unknown",
      kea_fabric_api_base_url: m.kea_fabric_api_base_url ?? null,
      dhcp_mode: m.dhcp_mode ?? null,
    };
  }

  async getEnvSchema(): Promise<{ keys: EnvSchemaEntry[] }> {
    return this.getJsonValidated("/v1/config/env/schema", envSchemaResponseSchema);
  }

  async getEnvConfig(): Promise<EnvConfigResponse> {
    return this.getJsonValidated("/v1/config/env", envConfigResponseSchema);
  }

  private async fetchWithToken<T>(
    path: string,
    init: RequestInit,
    schema: ZodType<T>,
    apiToken: string,
  ): Promise<{ status: number; data: T }> {
    const res = await fetch(this.url(path), {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Token": apiToken,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new GatewayError({
        code: "parse_failed",
        path,
        message: `${init.method ?? "GET"} ${path} returned non-JSON`,
      });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new GatewayError({
        code: "parse_failed",
        path,
        message: `Invalid response shape for ${path}`,
        zodError: parsed.error,
      });
    }
    if (!res.ok && res.status !== 202) {
      throw new GatewayError({
        code: "http_error",
        path,
        message: `${init.method ?? "GET"} ${path} failed: ${res.status}`,
        status: res.status,
      });
    }
    return { status: res.status, data: parsed.data };
  }

  async patchEnvConfig(
    changes: Record<string, string>,
    apiToken: string,
  ): Promise<{ status: number; staged: Record<string, string> }> {
    const { status, data } = await this.fetchWithToken(
      "/v1/config/env",
      { method: "PATCH", body: JSON.stringify({ changes }) },
      envPatchResponseSchema,
      apiToken,
    );
    return { status, staged: data.staged };
  }

  async applyEnvConfig(apiToken: string): Promise<{ status: number; summary: string; example?: string }> {
    const { status, data } = await this.fetchWithToken(
      "/v1/mutations/env/apply",
      { method: "POST", body: "{}" },
      hostActionResponseSchema,
      apiToken,
    );
    return {
      status,
      summary: data.summary,
      example: data.next_steps.example,
    };
  }

  async rollbackEnvConfig(apiToken: string): Promise<{ status: number; summary: string; example?: string }> {
    const { status, data } = await this.fetchWithToken(
      "/v1/mutations/env/rollback",
      { method: "POST", body: "{}" },
      hostActionResponseSchema,
      apiToken,
    );
    return {
      status,
      summary: data.summary,
      example: data.next_steps.example,
    };
  }
}
