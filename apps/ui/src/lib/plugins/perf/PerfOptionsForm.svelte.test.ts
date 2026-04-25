import { mount, tick, unmount } from "svelte";
import { describe, expect, it } from "vitest";

import type { DashboardTile } from "../../dashboard/types";
import PerfOptionsFormTestRoot from "./PerfOptionsFormTestRoot.svelte";

function readDraft(el: HTMLElement): DashboardTile {
  const raw = el.querySelector('[data-testid="draft-json"]')?.textContent;
  if (!raw) throw new Error("missing draft-json");
  return JSON.parse(raw) as DashboardTile;
}

describe("PerfOptionsForm", () => {
  it("toggles network show-as-total without flipping network_by_adapter semantics", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const initial: DashboardTile = {
      id: "t1",
      pluginId: "perf.network",
      hostControl: "single-panel",
      displayMode: "full",
      options: { network_by_adapter: true, display_style: "gauge" },
    };

    const app = mount(PerfOptionsFormTestRoot, { target: el, props: { initial } });

    const cb = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cb.checked).toBe(false);

    cb.click();
    await tick();
    expect(readDraft(el).options?.network_by_adapter).toBe(false);
    expect(cb.checked).toBe(true);

    cb.click();
    await tick();
    expect(readDraft(el).options?.network_by_adapter).toBe(true);
    expect(cb.checked).toBe(false);

    unmount(app);
    el.remove();
  });

  it("toggles disk show-as-total without flipping disk_by_volume semantics", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const initial: DashboardTile = {
      id: "t2",
      pluginId: "perf.disk",
      hostControl: "single-panel",
      displayMode: "full",
      options: { disk_by_volume: true, display_style: "gauge" },
    };

    const app = mount(PerfOptionsFormTestRoot, { target: el, props: { initial } });

    const cb = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cb.checked).toBe(false);

    cb.click();
    await tick();
    expect(readDraft(el).options?.disk_by_volume).toBe(false);
    expect(cb.checked).toBe(true);

    cb.click();
    await tick();
    expect(readDraft(el).options?.disk_by_volume).toBe(true);
    expect(cb.checked).toBe(false);

    unmount(app);
    el.remove();
  });
});
