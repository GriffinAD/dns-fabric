import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tick } from "svelte";

import { dashboardResponseSchema } from "./dashboardZod";
import PiholeLayoutGrid from "./PiholeLayoutGrid.svelte";

describe("PiholeLayoutGrid", () => {
  const dashboard = dashboardResponseSchema.parse({
    node: "pi1",
    version: "0.4.0",
    widgets: [
      { id: "w1", title: "HA", section: "ha" },
      { id: "w2", title: "DNS", section: "pihole_dns" },
    ],
    sections: {
      ha: { ok: true },
      pihole_dns: { ok: true },
    },
  });

  const store: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: () => null,
      length: 0,
    } as Storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(store)) delete store[k];
  });

  it("renders a tile heading per widget", () => {
    render(PiholeLayoutGrid, { props: { dashboard } });
    expect(screen.getByRole("heading", { name: "HA" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "DNS" })).toBeTruthy();
  });

  it("restores widget order from localStorage", async () => {
    store["pihole-cp.widget-order.v1"] = JSON.stringify(["w2", "w1"]);
    render(PiholeLayoutGrid, { props: { dashboard } });
    await tick();
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]?.textContent?.trim()).toBe("DNS");
    expect(headings[1]?.textContent?.trim()).toBe("HA");
  });

  it("ignores invalid saved order JSON", async () => {
    store["pihole-cp.widget-order.v1"] = "not-json{";
    render(PiholeLayoutGrid, { props: { dashboard } });
    await tick();
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]?.textContent?.trim()).toBe("HA");
    expect(headings[1]?.textContent?.trim()).toBe("DNS");
  });

  it("hides drag handles when layout edit mode is off", () => {
    render(PiholeLayoutGrid, { props: { dashboard, layoutEditMode: false } });
    expect(screen.queryByTestId("pihole-cp-widget-drag-handle")).toBeNull();
  });

  it("shows drag handles when layout edit mode is on", () => {
    render(PiholeLayoutGrid, { props: { dashboard, layoutEditMode: true } });
    expect(screen.getAllByTestId("pihole-cp-widget-drag-handle")).toHaveLength(2);
  });
});
