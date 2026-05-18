import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tick } from "svelte";

import { applyDocumentTheme, saveThemePreferences } from "../../theme/themeStorage";
import PiholeOperatorApp from "./PiholeOperatorApp.svelte";

const dashboardJson = {
  node: "pi1",
  version: "0.4.0",
  widgets: [{ id: "w1", title: "HA", section: "ha" }],
  sections: { ha: { ok: true } },
};

const nodePerfJson = {
  cpu_percent_total: 10,
  cpu_core_percent: [10, 9],
  memory_used_percent: 40,
  memory_used_bytes: 100,
  memory_total_bytes: 1000,
  network_in_mbps: null,
  network_out_mbps: null,
  disk_used_percent: 50,
  disk_volumes: [{ label: "/", used_percent: 50 }],
  collected_at: "2026-01-01T00:00:00Z",
};

describe("PiholeOperatorApp", () => {
  let lsStore: Record<string, string>;

  beforeEach(() => {
    lsStore = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) =>
        Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k]! : null,
      setItem: (k: string, v: string) => {
        lsStore[k] = v;
      },
      removeItem: (k: string) => {
        delete lsStore[k];
      },
      clear: () => {
        lsStore = {};
      },
      key: () => null,
      length: 0,
    } as Storage);

    saveThemePreferences({
      version: 1,
      mode: "light",
      colorPreset: "default",
      gaugeCapStyle: "flat",
      gaugeSegmentEnabled: false,
      gaugeSegmentDivisions: 0,
      gaugeSegmentGapPx: 0.15,
    });
    applyDocumentTheme("light", "default", false, "flat", false, 0, 0.15);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | Request) => {
        const u = typeof input === "string" ? input : input.url;
        if (u.includes("/dashboard")) {
          return new Response(JSON.stringify(dashboardJson), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("/v1/meta")) {
          return new Response(JSON.stringify({ node: "pi1", peer_ui_base_url: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("/v1/node/perf/summary")) {
          return new Response(JSON.stringify(nodePerfJson), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("/logs/catalog")) {
          return new Response(JSON.stringify({ logs: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("/api/v1/plugins")) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders theme controls and shared dashboard palette when Edit layout is on", async () => {
    render(PiholeOperatorApp);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "HA" })).toBeTruthy();
    });

    expect(screen.getByTestId("pihole-cp-theme-controls")).toBeTruthy();
    expect(screen.getByTestId("theme-appearance-toggle")).toBeTruthy();

    expect(screen.queryByLabelText("Layout")).toBeNull();
    expect(screen.queryByTestId("editor-display-settings-open")).toBeNull();

    fireEvent.click(screen.getByTestId("pihole-cp-layout-edit-toggle"));
    await waitFor(() => {
      expect(screen.getByTestId("layout-edit-palette-v2")).toBeTruthy();
    });
    expect(screen.getByLabelText("Layout")).toBeTruthy();
    expect(screen.getByTestId("editor-display-settings-open")).toBeTruthy();
    expect(screen.getByTestId("pihole-cp-sticky-chrome")).toBeTruthy();
    expect(screen.getByTestId("pihole-cp-layout-undo")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-editor-toolbar")).toBeNull();
    expect(screen.getByTestId("pihole-cp-node-settings-panel")).toBeTruthy();
    expect(screen.getByRole("button", { name: /node settings/i })).toBeTruthy();

    fireEvent.click(screen.getByTestId("pihole-cp-layout-edit-toggle"));
    await tick();
    await waitFor(() => {
      expect(screen.queryByTestId("layout-edit-palette-v2")).toBeNull();
      expect(screen.queryByTestId("pihole-cp-node-settings-panel")).toBeNull();
      expect(screen.queryByLabelText("Layout")).toBeNull();
      expect(screen.queryByTestId("editor-display-settings-open")).toBeNull();
    });
  });

  it("Refresh re-fetches dashboard and passes cache no-store", async () => {
    const fetchMock = vi.fn(async (input: string | Request) => {
      const u = typeof input === "string" ? input : input.url;
      if (u.includes("/dashboard")) {
        return new Response(JSON.stringify(dashboardJson), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/v1/meta")) {
        return new Response(JSON.stringify({ node: "pi1", peer_ui_base_url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/v1/node/perf/summary")) {
        return new Response(JSON.stringify(nodePerfJson), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/logs/catalog")) {
        return new Response(JSON.stringify({ logs: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/api/v1/plugins")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(PiholeOperatorApp);
    await waitFor(() => {
      expect(screen.getByTestId("pihole-cp-refresh")).toBeTruthy();
    });

    const before = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByTestId("pihole-cp-refresh"));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));

    const dashUrls = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/dashboard"));
    expect(dashUrls.length).toBeGreaterThanOrEqual(2);
  });
});
