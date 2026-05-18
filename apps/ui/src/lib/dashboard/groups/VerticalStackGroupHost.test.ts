import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { makeVerticalStackGroup } from "./hostGroupFactory";
import VerticalStackGroupHostHarness from "./VerticalStackGroupHost.harness.svelte";

describe("VerticalStackGroupHost", () => {
  it("renders section labels and toggles collapse", async () => {
    const group = makeVerticalStackGroup("stack-1");
    group.children = [
      {
        id: "tile-1",
        tabLabel: "CPU",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
      },
      {
        id: "tile-2",
        tabLabel: "RAM",
        pluginId: "perf.ram",
        hostControl: "single-panel",
        displayMode: "full",
      },
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

  it("renames a section from the header control", async () => {
    const onGroupChange = vi.fn();
    const group = makeVerticalStackGroup("stack-1");
    group.children = [
      {
        id: "tile-1",
        tabLabel: "CPU",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ];
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

  it("calls onGroupChange when adding a nested section container", async () => {
    const onGroupChange = vi.fn();
    const group = makeVerticalStackGroup("stack-1");
    render(VerticalStackGroupHostHarness, {
      props: { group, editLayout: true, onGroupChange },
    });
    await fireEvent.click(screen.getByTestId("stack-add-nested-section"));
    expect(onGroupChange).toHaveBeenCalled();
  });

  it("removes a section when delete is confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onGroupChange = vi.fn();
    const group = makeVerticalStackGroup("stack-1");
    group.children = [
      {
        id: "tile-1",
        tabLabel: "CPU",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
      },
      {
        id: "tile-2",
        tabLabel: "RAM",
        pluginId: "perf.ram",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ];
    render(VerticalStackGroupHostHarness, {
      props: { group, editLayout: true, onGroupChange },
    });
    await fireEvent.click(screen.getAllByTestId("stack-section-delete-button")[0]!);
    expect(onGroupChange).toHaveBeenCalled();
    expect(onGroupChange.mock.calls.at(-1)?.[0].children).toHaveLength(1);
    vi.restoreAllMocks();
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
            id: "t1",
            tabLabel: "One",
            pluginId: "perf.cpu",
            hostControl: "single-panel",
            displayMode: "full",
          },
        ],
      },
    ];
    render(VerticalStackGroupHostHarness, { props: { group } });
    expect(screen.getByTestId("tab-group-host")).toBeTruthy();
  });

  it("calls onGroupChange when adding a plugin section", async () => {
    const onGroupChange = vi.fn();
    const group = makeVerticalStackGroup("stack-1");
    render(VerticalStackGroupHostHarness, {
      props: {
        group,
        editLayout: true,
        onGroupChange,
        plugins: [{ id: "perf.cpu", name: "CPU", enabled: true, allowed_host_controls: ["single-panel"] }],
      },
    });
    const select = screen.getByTestId("stack-add-plugin-select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "perf.cpu" } });
    await fireEvent.click(screen.getByTestId("stack-add-plugin-confirm"));
    expect(onGroupChange).toHaveBeenCalled();
  });
});
