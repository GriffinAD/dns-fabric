import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import type { DashboardGroup } from "../types";
import { makeVerticalStackGroup } from "./hostGroupFactory";
import VerticalStackGroupHostHarness from "./VerticalStackGroupHost.harness.svelte";
import VerticalStackGroupHostPaneHarness from "./VerticalStackGroupHost.pane.harness.svelte";
import type { HostPaneEditorBindings } from "./hostGroupPaneEditorTypes";

function stackPane(
  paneId: string,
  sectionLabel: string,
  tileId: string,
  pluginId: string,
): DashboardGroup {
  return {
    kind: "group",
    id: paneId,
    showBorder: true,
    tabLabel: sectionLabel,
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

describe("VerticalStackGroupHost", () => {
  it("renders section labels and toggles collapse", async () => {
    const group = makeVerticalStackGroup("stack-1");
    group.children = [
      stackPane("pane-a", "CPU", "tile-a", "perf.cpu"),
      stackPane("pane-b", "RAM", "tile-b", "perf.ram"),
    ];
    render(VerticalStackGroupHostHarness, { props: { group, editLayout: true } });
    expect(screen.getByText("CPU")).toBeTruthy();
    expect(screen.getByText("RAM")).toBeTruthy();

    const toggles = screen.getAllByTestId("stack-section-toggle");
    await fireEvent.click(toggles[0]!);
    expect(screen.getAllByTestId("stack-section-body").length).toBe(1);

    await fireEvent.click(toggles[0]!);
    expect(screen.getAllByTestId("stack-section-body").length).toBe(2);
  });

  it("shows pane drop editor for empty section in edit mode", () => {
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
    render(VerticalStackGroupHostPaneHarness, {
      props: { group: makeVerticalStackGroup("stack-empty"), paneEditor },
    });
    expect(screen.getByTestId("host-group-pane-editor")).toBeTruthy();
    expect(screen.getByTestId("editor-group-nowrap-empty")).toBeTruthy();
  });

  it("renames a section from the header control", async () => {
    const onGroupChange = vi.fn();
    const group = makeVerticalStackGroup("stack-1");
    group.children = [stackPane("pane-a", "CPU", "tile-a", "perf.cpu")];
    render(VerticalStackGroupHostHarness, {
      props: { group, editLayout: true, onGroupChange },
    });
    await fireEvent.click(screen.getByTestId("stack-section-rename-button"));
    const input = screen.getByTestId("stack-section-rename-input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Metrics" } });
    fireEvent.blur(input);
    expect(onGroupChange).toHaveBeenCalled();
    expect(onGroupChange.mock.calls.at(-1)?.[0].children[0]?.tabLabel).toBe("Metrics");
  });

  it("adds an empty section pane when clicking + Section in edit mode", async () => {
    const onGroupChange = vi.fn();
    render(VerticalStackGroupHostHarness, {
      props: { group: makeVerticalStackGroup("stack-add"), editLayout: true, onGroupChange },
    });
    await fireEvent.click(screen.getByTestId("stack-add-section-button"));
    expect(onGroupChange).toHaveBeenCalled();
    const next = onGroupChange.mock.calls[0]?.[0] as DashboardGroup;
    expect(next.children).toHaveLength(2);
    const added = next.children[1];
    expect(added).toMatchObject({ kind: "group", tabLabel: "Section 2", children: [] });
  });

  it("removes a section when delete is confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onGroupChange = vi.fn();
    const group = makeVerticalStackGroup("stack-1");
    group.children = [
      stackPane("pane-a", "CPU", "tile-a", "perf.cpu"),
      stackPane("pane-b", "RAM", "tile-b", "perf.ram"),
    ];
    render(VerticalStackGroupHostHarness, {
      props: { group, editLayout: true, onGroupChange },
    });
    await fireEvent.click(screen.getAllByTestId("stack-section-delete-button")[0]!);
    expect(onGroupChange).toHaveBeenCalled();
    expect(onGroupChange.mock.calls.at(-1)?.[0].children).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("toggles collapse in read mode without onGroupChange", async () => {
    const group = makeVerticalStackGroup("stack-read");
    group.children = [
      stackPane("pane-a", "CPU", "tile-a", "perf.cpu"),
      stackPane("pane-b", "RAM", "tile-b", "perf.ram"),
    ];
    render(VerticalStackGroupHostHarness, { props: { group, editLayout: false } });
    const toggles = screen.getAllByTestId("stack-section-toggle");
    await fireEvent.click(toggles[0]!);
    expect(screen.getAllByTestId("stack-section-body").length).toBe(1);
    await fireEvent.click(toggles[0]!);
    expect(screen.getAllByTestId("stack-section-body").length).toBe(2);
  });

  it("renders nested tab-control inside a section", () => {
    const group = makeVerticalStackGroup("stack-1");
    group.children = [
      {
        kind: "group",
        id: "inner-tabs",
        showBorder: true,
        tabLabel: "Tabs",
        hostControl: "tab-control",
        hostState: { activeChildId: "t1" },
        children: [
          {
            kind: "group",
            id: "t1",
            showBorder: true,
            tabLabel: "One",
            children: [
              {
                id: "tile-1",
                pluginId: "perf.cpu",
                hostControl: "single-panel",
                displayMode: "full",
              },
            ],
          },
        ],
      },
    ];
    render(VerticalStackGroupHostHarness, { props: { group } });
    expect(screen.getByTestId("tab-group-host")).toBeTruthy();
  });
});
