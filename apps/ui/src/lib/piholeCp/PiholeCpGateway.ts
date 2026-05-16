import { z, type ZodType } from "zod";

import { GatewayError } from "../dataGateway";
import {
  envConfigResponseSchema,
  envApplyResponseSchema,
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
import { isDashboardMetaCoherent, sleep } from "./piholeCpPostApplyWait";

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

/** Map FastAPI / control-plane JSON error bodies to a short operator message. */
/** Poll GET /health until the control plane answers (e.g. after apply recreates the container). */
export async function waitForControlPlaneReady(
  baseUrl: string,
  opts?: { attempts?: number; delayMs?: number },
): Promise<void> {
  const attempts = opts?.attempts ?? 90;
  const delayMs = opts?.delayMs ?? 1000;
  const healthUrl = joinControlPlaneUrl(baseUrl, "/health");
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(healthUrl, { cache: "no-store" });
      if (res.ok) return;
    } catch {
      /* container restarting */
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new GatewayError({
    code: "http_error",
    path: "/health",
    message:
      "Control plane did not become ready after apply. Wait a minute and reload the page.",
  });
}

async function fetchHealthOk(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(joinControlPlaneUrl(baseUrl, "/health"), { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * After deferred host apply (HTTP 200 before compose rebuild), the old container still
 * answers /health until the background job recreates the stack. Wait for down-then-up.
 */
export async function waitForControlPlaneRestart(
  baseUrl: string,
  opts?: {
    graceMs?: number;
    pollMs?: number;
    waitForDownMs?: number;
    waitForUpAttempts?: number;
    onProgress?: (label: string) => void;
  },
): Promise<void> {
  const report = opts?.onProgress;
  const graceMs = opts?.graceMs ?? 1500;
  const pollMs = opts?.pollMs ?? 500;
  const waitForDownMs = opts?.waitForDownMs ?? 180_000;
  const waitForUpAttempts = opts?.waitForUpAttempts ?? 120;

  report?.("Host apply starting…");
  await sleep(graceMs);

  report?.("Waiting for control plane to stop…");
  const downDeadline = Date.now() + waitForDownMs;
  let sawDown = false;
  let downPolls = 0;
  while (Date.now() < downDeadline) {
    if (!(await fetchHealthOk(baseUrl))) {
      sawDown = true;
      break;
    }
    downPolls += 1;
    if (downPolls % 10 === 0) {
      report?.("Still waiting for control plane to stop…");
    }
    await sleep(pollMs);
  }

  if (!sawDown) {
    throw new GatewayError({
      code: "http_error",
      path: "/health",
      message:
        "Control plane did not restart after apply (health stayed up). Check host apply logs and audit.jsonl.",
    });
  }

  report?.("Waiting for control plane to come back…");
  await waitForControlPlaneReady(baseUrl, { attempts: waitForUpAttempts, delayMs: pollMs });
  report?.("Control plane is back online");
}

/** Poll until staged pending-env.json is cleared (host apply finished). */
export async function waitForEnvPendingCleared(
  gw: PiholeCpGateway,
  opts?: { attempts?: number; delayMs?: number; onProgress?: (label: string) => void },
): Promise<EnvConfigResponse> {
  const attempts = opts?.attempts ?? 240;
  const delayMs = opts?.delayMs ?? 500;
  const report = opts?.onProgress;

  report?.("Waiting for host apply to finish…");
  for (let i = 0; i < attempts; i++) {
    const env = await gw.getEnvConfig();
    const pendingEmpty = !env.pending || Object.keys(env.pending).length === 0;
    if (pendingEmpty) {
      report?.("Staged patch cleared");
      return env;
    }
    if (i > 0 && i % 6 === 0) {
      report?.("Still waiting for host apply…");
    }
    await sleep(delayMs);
  }

  throw new GatewayError({
    code: "http_error",
    path: "/v1/config/env",
    message:
      "Host apply did not finish (staged patch still present). On the node: sudo bash /opt/pihole-ha/ops/runtime/control-plane/apply-env-patch.sh --node pi2 --patch-file /opt/pihole-ha/data/control-plane/pending-env.json and check data/logs/control-plane-audit.jsonl for host_apply_failed.",
  });
}

/**
 * Wait for deferred host apply: pending file cleared means success.
 * Uses health only for progress labels (DNSCrypt-only apply may not restart control-plane).
 */
export async function waitForHostEnvApplyComplete(
  baseUrl: string,
  gw: PiholeCpGateway,
  opts?: { maxMs?: number; pollMs?: number; onProgress?: (label: string) => void },
): Promise<EnvConfigResponse> {
  const maxMs = opts?.maxMs ?? 240_000;
  const pollMs = opts?.pollMs ?? 500;
  const report = opts?.onProgress;
  const deadline = Date.now() + maxMs;
  let sawDown = false;
  let ticks = 0;

  report?.("Host apply running…");
  while (Date.now() < deadline) {
    let env: EnvConfigResponse | null = null;
    try {
      env = await gw.getEnvConfig();
    } catch {
      /* control plane may be restarting */
    }
    if (env && (!env.pending || Object.keys(env.pending).length === 0)) {
      report?.("Apply finished");
      return env;
    }

    const healthOk = await fetchHealthOk(baseUrl);
    if (!healthOk) sawDown = true;

    if (!sawDown) {
      report?.("Waiting for stack reconcile to start…");
    } else if (!healthOk) {
      report?.("Stack restarting…");
    } else {
      report?.("Waiting for host apply to finish…");
    }

    ticks += 1;
    if (ticks % 8 === 0 && env?.pending) {
      report?.(`Still applying: ${Object.keys(env.pending).join(", ")}…`);
    }
    await sleep(pollMs);
  }

  throw new GatewayError({
    code: "http_error",
    path: "/v1/config/env",
    message:
      "Host apply timed out (staged patch still present). The host script may have failed — check audit.jsonl on the node or run apply-env-patch.sh manually.",
  });
}

/** Poll dashboard + meta until Kea DHCP widgets match meta.dhcp_mode (post-restart). */
export async function waitForPiholeCpDashboardCoherent(
  gw: PiholeCpGateway,
  opts?: { attempts?: number; delayMs?: number; onProgress?: (label: string) => void },
): Promise<{ dashboard: DashboardResponse; meta: PiholeCpMeta }> {
  const attempts = opts?.attempts ?? 30;
  const delayMs = opts?.delayMs ?? 500;
  const report = opts?.onProgress;

  report?.("Syncing dashboard…");
  for (let i = 0; i < attempts; i++) {
    try {
      const [dashboard, meta] = await Promise.all([gw.getDashboard(), gw.getMeta()]);
      if (isDashboardMetaCoherent(meta, dashboard)) {
        report?.("Dashboard updated");
        return { dashboard, meta };
      }
    } catch {
      /* stack still starting */
    }
    if (i > 0 && i % 6 === 0) {
      report?.("Still syncing dashboard…");
    }
    await sleep(delayMs);
  }

  throw new GatewayError({
    code: "http_error",
    path: "/dashboard",
    message:
      "Dashboard did not match node meta after apply. Hard-reload the page or use Refresh.",
  });
}

export function controlPlaneErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === "string" && detail.length > 0) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first) {
      return String((first as { msg: unknown }).msg);
    }
  }
  const error = record.error;
  const message = record.message;
  if (typeof error === "string" && typeof message === "string") {
    return `${error}: ${message}`;
  }
  if (typeof message === "string" && message.length > 0) return message;
  return fallback;
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
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      if (!res.ok) {
        throw new GatewayError({
          code: "http_error",
          path,
          message: `GET ${path} failed: ${res.status} ${res.statusText}`,
          status: res.status,
        });
      }
      throw new GatewayError({
        code: "parse_failed",
        path,
        message: `GET ${path} returned non-JSON`,
      });
    }
    if (!res.ok) {
      throw new GatewayError({
        code: "http_error",
        path,
        message: controlPlaneErrorMessage(body, `GET ${path} failed: ${res.status} ${res.statusText}`),
        status: res.status,
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
    if (!res.ok && res.status !== 202) {
      throw new GatewayError({
        code: "http_error",
        path,
        message: controlPlaneErrorMessage(
          body,
          `${init.method ?? "GET"} ${path} failed: ${res.status}`,
        ),
        status: res.status,
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

  async applyEnvConfig(
    apiToken: string,
  ): Promise<{ status: number; applied: boolean; summary: string; example?: string; backupPath?: string }> {
    const { status, data } = await this.fetchWithToken(
      "/v1/mutations/env/apply",
      { method: "POST", body: "{}" },
      envApplyResponseSchema,
      apiToken,
    );
    if (data.kind === "applied") {
      return { status, applied: true, summary: data.summary, backupPath: data.backup_path };
    }
    return {
      status,
      applied: false,
      summary: data.summary,
      example: data.next_steps.example,
    };
  }

  async rollbackEnvConfig(
    apiToken: string,
  ): Promise<{ status: number; applied: boolean; summary: string; example?: string; backupPath?: string }> {
    const { status, data } = await this.fetchWithToken(
      "/v1/mutations/env/rollback",
      { method: "POST", body: "{}" },
      envApplyResponseSchema,
      apiToken,
    );
    if (data.kind === "applied") {
      return { status, applied: true, summary: data.summary, backupPath: data.backup_path };
    }
    return {
      status,
      applied: false,
      summary: data.summary,
      example: data.next_steps.example,
    };
  }
}
