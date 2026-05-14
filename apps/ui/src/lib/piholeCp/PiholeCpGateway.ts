import { z } from "zod";

import { GatewayError } from "../dataGateway";
import {
  dashboardResponseSchema,
  logsCatalogResponseSchema,
  metaResponseSchema,
  type DashboardResponse,
  type LogsCatalogResponse,
} from "./dashboardZod";

export type PiholeCpMeta = { peer_ui_base_url: string | null; node: string };

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
    const res = await fetch(this.url(path), { headers: { Accept: "application/json" } });
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
    };
  }
}
