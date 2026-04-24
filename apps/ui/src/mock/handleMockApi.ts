import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseDashboardLayout } from "../lib/dashboard/layoutStorage";
import { baseFixtures } from "./fixtures";
import { perfSummaryForTick } from "./perfSimulate";
import { getDiscoveryScan, getPerfTick, getSavedLayout, nextPerfTick, setDiscoveryPaused, setSavedLayout } from "./state";

const _mockDir = dirname(fileURLToPath(import.meta.url));
/** Repo-root ``.fabric-data/dashboard-layouts.orig.json`` (read-only; never written by the mock). */
const BASELINE_LAYOUTS_FILE = join(_mockDir, "../../../../.fabric-data/dashboard-layouts.orig.json");

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
      const snap = perfSummaryForTick(n);
      send({
        topic: "fabric.perf.updated",
        occurred_at: new Date().toISOString(),
        payload: { ...snap, tick: n },
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

  const resetMatch = pathOnly.match(/^\/api\/v1\/dashboards\/([^/]+)\/layout\/reset$/);
  if (method === "POST" && resetMatch) {
    const dashboardId = resetMatch[1]!;
    if (!existsSync(BASELINE_LAYOUTS_FILE)) {
      sendJson(res, 404, { title: "baseline layout file not found", status: 404 });
      return true;
    }
    try {
      const all = JSON.parse(readFileSync(BASELINE_LAYOUTS_FILE, "utf8")) as unknown;
      if (!all || typeof all !== "object" || Array.isArray(all)) {
        sendJson(res, 500, { title: "baseline layout file must be a JSON object", status: 500 });
        return true;
      }
      const rawLayout = (all as Record<string, unknown>)[dashboardId];
      const layout = parseDashboardLayout(rawLayout);
      if (!layout) {
        sendJson(res, 400, { title: "Invalid or missing layout in baseline file", status: 400 });
        return true;
      }
      setSavedLayout(layout);
      sendJson(res, 200, layout);
    } catch {
      sendJson(res, 500, { title: "baseline layout file is not valid JSON", status: 500 });
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
        const layout = parseDashboardLayout(parsed);
        if (!layout) {
          sendJson(res, 400, { title: "Invalid layout", status: 400 });
          return true;
        }
        setSavedLayout(layout);
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

  if (pathOnly === "/api/v1/perf/summary") {
    sendJson(res, 200, perfSummaryForTick(getPerfTick()));
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
