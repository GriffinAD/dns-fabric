import type { IncomingMessage, ServerResponse } from "node:http";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { dashboardLayoutExportFilename, parseDashboardLayout } from "../lib/dashboard/layout/layoutStorage";
import { baseFixtures } from "./fixtures";
import { perfSummaryForTick } from "./perfSimulate";
import { getDiscoveryScan, getPerfTick, getSavedLayout, nextPerfTick, setDiscoveryPaused, setSavedLayout } from "./state";

const _mockDir = dirname(fileURLToPath(import.meta.url));
/** Resolve repo-root `.fabric-data` from the mock module location. */
function resolveFabricDataDir(): string {
  const candidates = [
    resolve(_mockDir, "../../../../../.fabric-data"),
    resolve(_mockDir, "../../../../.fabric-data"),
    resolve(process.cwd(), ".fabric-data"),
  ];
  for (const dir of candidates) {
    const hasLayouts =
      existsSync(join(dir, "dashboard-layouts.json")) ||
      existsSync(join(dir, "dashboard-layouts.orig.json"));
    const hasLogs = existsSync(join(dir, "logs/system.jsonl"));
    if (existsSync(dir) && (hasLayouts || hasLogs)) return dir;
  }
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[1]!;
}

const FABRIC_DATA_DIR = resolveFabricDataDir();
/** Repo-root ``.fabric-data/dashboard-layouts.orig.json`` (read-only; never written by the mock). */
const BASELINE_LAYOUTS_FILE = join(FABRIC_DATA_DIR, "dashboard-layouts.orig.json");
const STRUCTURED_LOG_FILE = join(FABRIC_DATA_DIR, "logs/system.jsonl");

const listPaths = new Set([
  "/api/v1/dhcp/pools",
  "/api/v1/dhcp/clients",
  "/api/v1/dhcp/reservations",
  "/api/v1/discovery/records",
]);

type MockLogLevel = "CRITICAL" | "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";
type MockLogRecord = {
  ts: string;
  level: MockLogLevel;
  event: string;
  message: string;
  service: string;
  operation: string;
  subcategory: string;
  mode: string | null;
  request_id: string | null;
  trace_id: string | null;
  actor: string | null;
  error_type: string | null;
  error_message: string | null;
};

function readDiskStructuredLogs(): MockLogRecord[] {
  if (!existsSync(STRUCTURED_LOG_FILE)) return [];
  try {
    return readFileSync(STRUCTURED_LOG_FILE, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as MockLogRecord)
      .filter((row) => row && typeof row === "object" && typeof row.ts === "string");
  } catch {
    return [];
  }
}

function appendMockLog(
  level: MockLogLevel,
  event: string,
  message: string,
  operation: string,
  subcategory: string,
): void {
  const row: MockLogRecord = {
    ts: new Date().toISOString(),
    level,
    event,
    message,
    service: "api",
    operation,
    subcategory,
    mode: "mock",
    request_id: null,
    trace_id: null,
    actor: null,
    error_type: null,
    error_message: null,
  };
  try {
    mkdirSync(dirname(STRUCTURED_LOG_FILE), { recursive: true });
    appendFileSync(STRUCTURED_LOG_FILE, `${JSON.stringify(row)}\n`, "utf8");
  } catch {
    // Best-effort disk mirror for mock-mode observability.
  }
}

const dhcpClientsState = structuredClone(baseFixtures["/api/v1/dhcp/clients"] as { items: Record<string, unknown>[] });
const dhcpReservationsState = structuredClone(
  baseFixtures["/api/v1/dhcp/reservations"] as { items: Record<string, unknown>[] },
);

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

function sendReadableJsonDocument(res: ServerResponse, status: number, body: unknown): void {
  const escaped = JSON.stringify(body, null, 2)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>kea-fabric mock api response</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        background: #0b1220;
        color: #e5e7eb;
        font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
          "Courier New", monospace;
      }
      pre {
        margin: 0;
        padding: 16px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      @media (prefers-color-scheme: light) {
        body { background: #f8fafc; color: #111827; }
      }
    </style>
  </head>
  <body>
    <pre>${escaped}</pre>
  </body>
</html>`);
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

  appendMockLog("INFO", "api.request.completed", `${method} ${pathOnly}`, `${method} ${pathOnly}`, "request");

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

  if (method === "GET" && pathOnly === "/api/v1/admin/logs") {
    appendMockLog("INFO", "admin.logs.query", "admin logs query", "GET /api/v1/admin/logs", "admin");
    const diskRows = readDiskStructuredLogs();
    const service = url.searchParams.get("service");
    const operation = url.searchParams.get("operation");
    const subcategory = url.searchParams.get("subcategory");
    const level = url.searchParams.get("level");
    const mode = url.searchParams.get("mode");
    const cursorRaw = Number.parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const pageSizeRaw = Number.parseInt(
      url.searchParams.get("page_size") ?? url.searchParams.get("limit") ?? "500",
      10,
    );
    const cursor = Number.isNaN(cursorRaw) ? 0 : Math.max(0, cursorRaw);
    const pageSize = Number.isNaN(pageSizeRaw) ? 500 : Math.max(1, Math.min(500, pageSizeRaw));
    const filtered = diskRows.filter((row) => {
      if (service && row.service !== service) return false;
      if (operation && row.operation !== operation) return false;
      if (subcategory && row.subcategory !== subcategory) return false;
      if (level && row.level !== level) return false;
      if (mode && row.mode !== mode) return false;
      return true;
    });
    const items = filtered.slice(cursor, cursor + pageSize);
    const nextCursor = cursor + items.length >= filtered.length ? null : cursor + items.length;
    const totalPages = filtered.length > 0 ? Math.ceil(filtered.length / pageSize) : 0;
    const accept = String(req.headers.accept ?? "");
    const fetchDest = String(req.headers["sec-fetch-dest"] ?? "");
    const fetchMode = String(req.headers["sec-fetch-mode"] ?? "");
    const prefersDocument =
      accept.includes("text/html") || fetchDest === "document" || fetchMode === "navigate";
    const payload = {
      items,
      cursor,
      page_size: pageSize,
      next_cursor: nextCursor,
      total_count: filtered.length,
      total_pages: totalPages,
    };
    if (prefersDocument) {
      sendReadableJsonDocument(res, 200, payload);
    } else {
      sendJson(res, 200, payload);
    }
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
      appendMockLog(
        "WARN",
        "api.route.invalid_json",
        "invalid json body",
        "POST /api/v1/discovery/scan/pause",
        "validation",
      );
      sendJson(res, 400, { title: "Invalid JSON", status: 400 });
    }
    return true;
  }

  const patchClientMatch = pathOnly.match(/^\/api\/v1\/dhcp\/clients\/([^/]+)$/);
  if (method === "PATCH" && patchClientMatch) {
    try {
      const rawBody = await readBody(req);
      const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
      const allowed = new Set(["hostname", "vendor_name"]);
      const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.has(k)));
      if (Object.keys(patch).length === 0) {
        sendJson(res, 400, { title: "No editable fields provided", status: 400 });
        return true;
      }
      const id = decodeURIComponent(patchClientMatch[1]!);
      const idx = dhcpClientsState.items.findIndex((r) => r.id === id);
      if (idx < 0) {
        sendJson(res, 404, { title: "client not found", status: 404 });
        return true;
      }
      dhcpClientsState.items[idx] = { ...dhcpClientsState.items[idx], ...patch };
      sendJson(res, 200, dhcpClientsState.items[idx]);
    } catch {
      appendMockLog(
        "WARN",
        "api.route.invalid_json",
        "invalid json body",
        "PATCH /api/v1/dhcp/clients/{id}",
        "validation",
      );
      sendJson(res, 400, { title: "Invalid JSON", status: 400 });
    }
    return true;
  }

  const patchReservationMatch = pathOnly.match(/^\/api\/v1\/dhcp\/reservations\/([^/]+)$/);
  if (method === "PATCH" && patchReservationMatch) {
    try {
      const rawBody = await readBody(req);
      const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
      const allowed = new Set(["hardware_address", "reserved_address", "hostname"]);
      const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.has(k)));
      if (Object.keys(patch).length === 0) {
        sendJson(res, 400, { title: "No editable fields provided", status: 400 });
        return true;
      }
      const id = decodeURIComponent(patchReservationMatch[1]!);
      const idx = dhcpReservationsState.items.findIndex((r) => r.id === id);
      if (idx < 0) {
        sendJson(res, 404, { title: "reservation not found", status: 404 });
        return true;
      }
      dhcpReservationsState.items[idx] = { ...dhcpReservationsState.items[idx], ...patch };
      sendJson(res, 200, dhcpReservationsState.items[idx]);
    } catch {
      appendMockLog(
        "WARN",
        "api.route.invalid_json",
        "invalid json body",
        "PATCH /api/v1/dhcp/reservations/{id}",
        "validation",
      );
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

  const saveFileMatch = pathOnly.match(/^\/api\/v1\/dashboards\/([^/]+)\/layout\/save-file$/);
  if (method === "POST" && saveFileMatch) {
    try {
      const rawBody = await readBody(req);
      const parsed = JSON.parse(rawBody) as unknown;
      const layout = parseDashboardLayout(parsed);
      if (!layout) {
        sendJson(res, 400, { title: "Invalid layout", status: 400 });
        return true;
      }
      setSavedLayout(layout);
      const exportsDir = join(FABRIC_DATA_DIR, "dashboard-layout-exports");
      mkdirSync(exportsDir, { recursive: true });
      const stamp = dashboardLayoutExportFilename().replace(/\.json$/, "");
      let basename = `${stamp}.json`;
      let outPath = join(exportsDir, basename);
      let i = 0;
      while (existsSync(outPath) && i < 999) {
        i += 1;
        basename = `${stamp}_${i}.json`;
        outPath = join(exportsDir, basename);
      }
      writeFileSync(outPath, JSON.stringify(layout, null, 2) + "\n", "utf8");
      sendJson(res, 200, { filename: basename });
    } catch {
      appendMockLog(
        "WARN",
        "api.route.invalid_json",
        "invalid json body",
        "POST /api/v1/dashboards/{id}/layout/save-file",
        "validation",
      );
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
        const layout = parseDashboardLayout(parsed);
        if (!layout) {
          sendJson(res, 400, { title: "Invalid layout", status: 400 });
          return true;
        }
        setSavedLayout(layout);
        res.statusCode = 204;
        res.end();
      } catch {
        appendMockLog(
          "WARN",
          "api.route.invalid_json",
          "invalid json body",
          "PUT /api/v1/dashboards/{id}/layout",
          "validation",
        );
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

  let payload: unknown;
  if (pathOnly === "/api/v1/dhcp/clients") {
    payload = dhcpClientsState;
  } else if (pathOnly === "/api/v1/dhcp/reservations") {
    payload = dhcpReservationsState;
  } else {
    payload = baseFixtures[pathOnly];
  }
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
