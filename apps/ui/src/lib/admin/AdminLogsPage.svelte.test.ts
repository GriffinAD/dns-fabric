import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataGateway } from "../dataGateway";
import type { AdminLogRecord } from "../api/types";
import AdminLogsPage from "./AdminLogsPage.svelte";

function buildLogRows(count: number): AdminLogRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    ts: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
    level: "INFO",
    event: `event.${i}`,
    message: `message ${i}`,
    service: "api",
    operation: "GET /api/v1/meta",
    subcategory: "request",
    mode: "mock",
    request_id: `req-${i}`,
    trace_id: null,
    actor: "operator",
    error_type: null,
    error_message: null,
  }));
}

function makeGateway(): DataGateway {
  return {
    getHealth: vi.fn().mockResolvedValue({
      status: "ok",
      checked_at: "2026-01-01T00:00:00Z",
    }),
  } as unknown as DataGateway;
}

describe("AdminLogsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows total matches in table title", async () => {
    const rows = buildLogRows(30);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: rows, total_count: 30 }),
      }),
    );
    render(AdminLogsPage, { props: { gateway: makeGateway() } });
    await screen.findByText("Logging");
    await waitFor(() => {
      expect(screen.getByText("Logging (30)")).toBeTruthy();
    });
    expect(screen.getByText("Query logs")).toBeTruthy();
  });

  it("times out slow queries and clears loading state", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    render(AdminLogsPage, { props: { gateway: makeGateway() } });
    expect(screen.getByText("Loading logs…")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(8000);
    await screen.findByText("Log query timed out after 8 seconds");
    expect(screen.queryByText("Loading logs…")).toBeNull();
  });

  it("cancel button exits loading state immediately", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    render(AdminLogsPage, { props: { gateway: makeGateway() } });
    const cancel = await screen.findByText("Cancel");
    await fireEvent.click(cancel);
    await waitFor(() => {
      expect(screen.getByText("Query cancelled.")).toBeTruthy();
    });
    expect(screen.queryByText("Loading logs…")).toBeNull();
  });
});
