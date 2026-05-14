import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tick } from "svelte";

import { applyDocumentTheme, saveThemePreferences } from "../theme/themeStorage";
import PiholeOperatorApp from "./PiholeOperatorApp.svelte";

const dashboardJson = {
  node: "pi1",
  version: "0.4.0",
  widgets: [{ id: "w1", title: "HA", section: "ha" }],
  sections: { ha: { ok: true } },
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
        if (u.includes("/logs/catalog")) {
          return new Response(JSON.stringify({ logs: [] }), {
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

  it("renders theme controls and toggles layout edit mode (drag handles)", async () => {
    render(PiholeOperatorApp);
    await waitFor(() => {
      expect(screen.getByTestId("pihole-cp-widget-drag-handle")).toBeTruthy();
    });

    expect(screen.getByTestId("pihole-cp-theme-controls")).toBeTruthy();
    expect(screen.getByTestId("theme-appearance-toggle")).toBeTruthy();

    fireEvent.click(screen.getByTestId("pihole-cp-layout-edit-toggle"));
    await tick();
    expect(screen.queryByTestId("pihole-cp-widget-drag-handle")).toBeNull();

    fireEvent.click(screen.getByTestId("pihole-cp-layout-edit-toggle"));
    await waitFor(() => {
      expect(screen.getByTestId("pihole-cp-widget-drag-handle")).toBeTruthy();
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
      if (u.includes("/logs/catalog")) {
        return new Response(JSON.stringify({ logs: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(PiholeOperatorApp);
    await tick();
    await tick();
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(0));

    const before = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByTestId("pihole-cp-refresh"));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));

    const dashUrls = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/dashboard"));
    expect(dashUrls.length).toBeGreaterThanOrEqual(2);
  });
});
