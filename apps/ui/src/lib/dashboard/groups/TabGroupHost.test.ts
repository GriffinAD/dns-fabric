import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import type { DashboardGroup } from "../types";
import { makeTabControlGroup } from "./hostGroupFactory";
import TabGroupHostHarness from "./TabGroupHost.harness.svelte";
import TabGroupHostPaneHarness from "./TabGroupHost.pane.harness.svelte";
import type { HostPaneEditorBindings } from "./hostGroupPaneEditorTypes";

function tabPane(
  paneId: string,
  tabLabel: string,
  tileId: string,
  pluginId: string,
): DashboardGroup {
  return {
    kind: "group",
    id: paneId,
    showBorder: true,
    tabLabel,
    children: [
      {
        id: tileId,
        pluginId,
        hostControl: "single-panel",
        displayMode: "full",
      },
    ],
  };
}

function tabGroupFixture(): DashboardGroup {
  return {
    kind: "group",
    id: "tg1",
    showBorder: true,
    hostControl: "tab-control",
    hostState: { activeChildId: "tab-a" },
    children: [
      tabPane("tab-a", "Alpha", "tile-a", "perf.cpu"),
      tabPane("tab-b", "Beta", "tile-b", "perf.ram"),
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
    expect(document.querySelector('[data-tile-id="tile-a"]')).toBeTruthy();
    expect(document.querySelector('[data-tile-id="tile-b"]')).toBeNull();

    const betaTab = screen.getByRole("tab", { name: /Beta/i });
    await fireEvent.click(betaTab);

    expect(document.querySelector('[data-tile-id="tile-b"]')).toBeTruthy();
    expect(document.querySelector('[data-tile-id="tile-a"]')).toBeNull();
  });

  it("shows pane drop editor for empty tab panel in edit mode", () => {
    const paneEditor: HostPaneEditorBindings = {
      dropCb: { onDrop: () => {}, onDragOver: () => {}, onDragEnd: () => {} },
      getSubDndList: () => [],
      noWrapEditPortW: {},
      noWrapStripPortMeasure: () => ({ destroy: () => {} }),
      chromeDragSm: "",
      chromeEditSm: "",
      editorTileInPlay: () => false,
      editorGroupInPlay: () => false,
      groupInnerSurfaceDragActive: () => true,
    };
    render(TabGroupHostPaneHarness, {
      props: { group: makeTabControlGroup("tg-empty"), paneEditor },
    });
    expect(screen.getByTestId("host-group-pane-editor")).toBeTruthy();
    expect(screen.getByTestId("editor-group-nowrap-empty")).toBeTruthy();
  });

  it("adds an empty tab pane when clicking + Tab in edit mode", async () => {
    const onGroupChange = vi.fn();
    render(TabGroupHostHarness, {
      props: { group: makeTabControlGroup("tg-add"), editLayout: true, onGroupChange },
    });
    await fireEvent.click(screen.getByTestId("tab-add-button"));
    expect(onGroupChange).toHaveBeenCalled();
    const next = onGroupChange.mock.calls[0]?.[0] as DashboardGroup;
    expect(next.children).toHaveLength(2);
    const added = next.children[1];
    expect(added).toMatchObject({ kind: "group", tabLabel: "Tab 2", children: [] });
    expect(next.hostState?.activeChildId).toBe(added?.id);
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
