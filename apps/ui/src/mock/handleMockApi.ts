import type { IncomingMessage, ServerResponse } from "node:http";

import type { DashboardLayout } from "../lib/dashboard/types";
import { baseFixtures } from "./fixtures";
import { getDiscoveryScan, getSavedLayout, nextPerfTick, setDiscoveryPaused, setSavedLayout } from "./state";

const listPaths = new Set([
  "/api/v1/dhcp/pools",
  "/api/v1/dhcp/clients",
  "/api/v1/dhcp/reservations",
  "/api/v1/discovery/records",
]);

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function isDashboardLayout(value: unknown): value is DashboardLayout {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "number" || !Array.isArray(v.tiles)) return false;
  for (const t of v.tiles) {
    if (!t || typeof t !== "object") return false;
    const tile = t as Record<string, unknown>;
    if (typeof tile.id !== "string" || typeof tile.pluginId !== "string") return false;
    if (typeof tile.hostControl !== "string" || typeof tile.displayMode !== "string") return false;
  }
  return true;
}

/**
 * Returns true if the request was handled (caller should not call next).
 */
export async function handleMockApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  // When set, Vite proxies /api to the real backend (e.g. `uv run kea-fabric-api` on :8080).
  if (process.env.KEA_FABRIC_UI_PROXY_API === "1") {
    return false;
  }

  const raw = req.url ?? "";
  if (!raw.startsWith("/api/v1")) {
    return false;
  }

  const url = new URL(raw, "http://localhost");
  const pathOnly = url.pathname;
  const method = (req.method ?? "GET").toUpperCase();

  if (method === "GET" && pathOnly === "/api/v1/events/stream") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const tick = () => {
      const n = nextPerfTick();
      send({
        topic: "fabric.perf.updated",
        occurred_at: new Date().toISOString(),
        payload: { tick: n, cpu_percent_total: 20 + (n % 15) },
      });
    };

    tick();
    const interval = setInterval(tick, 3000);

    req.on("close", () => {
      clearInterval(interval);
    });
    return true;
  }

  if (method === "GET" && pathOnly === "/api/v1/discovery/scan") {
    const scan = getDiscoveryScan();
    sendJson(res, 200, scan);
    return true;
  }

  if (method === "POST" && pathOnly === "/api/v1/discovery/scan/pause") {
    try {
      const rawBody = await readBody(req);
      const body = rawBody ? (JSON.parse(rawBody) as unknown) : {};
      const paused =
        body && typeof body === "object" && "paused" in body ? Boolean((body as { paused?: unknown }).paused) : true;
      const scan = setDiscoveryPaused(paused);
      sendJson(res, 200, scan);
    } catch {
      sendJson(res, 400, { title: "Invalid JSON", status: 400 });
    }
    return true;
  }

  const layoutMatch = pathOnly.match(/^\/api\/v1\/dashboards\/([^/]+)\/layout$/);
  if (layoutMatch) {
    if (method === "GET") {
      const layout = getSavedLayout();
      if (!layout) {
        sendJson(res, 404, { title: "layout not found", status: 404 });
      } else {
        sendJson(res, 200, layout);
      }
      return true;
    }
    if (method === "PUT") {
      try {
        const rawBody = await readBody(req);
        const parsed = JSON.parse(rawBody) as unknown;
        if (!isDashboardLayout(parsed)) {
          sendJson(res, 400, { title: "Invalid layout", status: 400 });
          return true;
        }
        setSavedLayout(parsed);
        res.statusCode = 204;
        res.end();
      } catch {
        sendJson(res, 400, { title: "Invalid JSON", status: 400 });
      }
      return true;
    }
  }

  if (method !== "GET") {
    sendJson(res, 405, { title: "Method not allowed", status: 405 });
    return true;
  }

  const mockMode = url.searchParams.get("mock");
  if (mockMode === "error") {
    sendJson(res, 503, { type: "about:blank", title: "mock error", status: 503, detail: "mock=error" });
    return true;
  }

  let payload: unknown = baseFixtures[pathOnly];
  if (payload === undefined) {
    sendJson(res, 404, { error: "not_found", path: pathOnly });
    return true;
  }

  if (mockMode === "empty" && listPaths.has(pathOnly) && payload && typeof payload === "object" && "items" in payload) {
    payload = { ...(payload as object), items: [] };
  }

  sendJson(res, 200, payload);
  return true;
}
