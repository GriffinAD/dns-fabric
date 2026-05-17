import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import type { DashboardGroup } from "../types";
import TabGroupHostHarness from "./TabGroupHost.harness.svelte";

function tabGroupFixture(): DashboardGroup {
  return {
    kind: "group",
    id: "tg1",
    showBorder: true,
    hostControl: "tab-control",
    hostState: { activeChildId: "tab-a" },
    children: [
      {
        id: "tab-a",
        tabLabel: "Alpha",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
      },
      {
        id: "tab-b",
        tabLabel: "Beta",
        pluginId: "perf.ram",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ],
  };
}

describe("TabGroupHost", () => {
  it("shows tab strip labels from children tabLabel", () => {
    render(TabGroupHostHarness, { props: { group: tabGroupFixture() } });
    const labels = screen.getAllByTestId("tab-strip-label");
    expect(labels.map((el) => el.textContent)).toEqual(["Alpha", "Beta"]);
  });

  it("switching tabs changes visible data-tile-id", async () => {
    render(TabGroupHostHarness, { props: { group: tabGroupFixture() } });
    expect(document.querySelector('[data-tile-id="tab-a"]')).toBeTruthy();
    expect(document.querySelector('[data-tile-id="tab-b"]')).toBeNull();

    const betaTab = screen.getByRole("tab", { name: /Beta/i });
    await fireEvent.click(betaTab);

    expect(document.querySelector('[data-tile-id="tab-b"]')).toBeTruthy();
    expect(document.querySelector('[data-tile-id="tab-a"]')).toBeNull();
  });

  it("calls onGroupChange when selecting a tab in edit mode", async () => {
    const onGroupChange = vi.fn();
    render(TabGroupHostHarness, {
      props: { group: tabGroupFixture(), editLayout: true, onGroupChange },
    });
    await fireEvent.click(screen.getByRole("tab", { name: /Beta/i }));
    expect(onGroupChange).toHaveBeenCalled();
    expect(onGroupChange.mock.calls[0]?.[0].hostState?.activeChildId).toBe("tab-b");
  });
});
