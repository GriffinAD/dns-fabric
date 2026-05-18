import { describe, expect, it } from "vitest";

import { makeTabControlGroup } from "./hostGroupFactory";
import {
  hostGroupPaneDropContainer,
  isEmptyHostPaneGroup,
  resolveHostPaletteChildDrop,
} from "./hostGroupPaneDrop";

describe("hostGroupPaneDrop", () => {
  it("detects empty panel groups inside tab/stack hosts", () => {
    const tabGroup = makeTabControlGroup("tabs-1");
    const pane = tabGroup.children[0]!;
    expect(isEmptyHostPaneGroup(pane)).toBe(true);
    expect(hostGroupPaneDropContainer(tabGroup.id, pane)).toMatch(/^g:.*:empty$/);
  });

  it("resolves fill-pane for palette drop on empty tab child slot", () => {
    const tabGroup = makeTabControlGroup("tabs-1");
    const paneId = tabGroup.children[0]!.id;
    expect(
      resolveHostPaletteChildDrop([tabGroup], tabGroup.id, paneId),
    ).toBe("fill-pane");
  });

  it("uses group child slot container for tile children", () => {
    const tabGroup = makeTabControlGroup("tabs-1");
    const tile = {
      id: "t1",
      pluginId: "perf.cpu",
      tabLabel: "CPU",
      hostControl: "single-panel" as const,
      displayMode: "full" as const,
    };
    expect(hostGroupPaneDropContainer(tabGroup.id, tile)).toBe("g:tabs-1:c:t1");
  });

  it("resolves append-host-slot when tab child is a tile", () => {
    const tabGroup = makeTabControlGroup("tabs-1");
    const withTile = {
      ...tabGroup,
      children: [
        {
          id: "t1",
          pluginId: "perf.cpu",
          tabLabel: "CPU",
          hostControl: "single-panel" as const,
          displayMode: "full" as const,
        },
      ],
    };
    expect(resolveHostPaletteChildDrop([withTile], withTile.id, "t1")).toBe(
      "append-host-slot",
    );
  });
});
