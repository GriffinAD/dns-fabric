import { describe, expect, it } from "vitest";

import {
  CONTAINER_DND_HANDLE,
  EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX,
  EDITOR_CHROME_TOP_OFFSET_PX,
  EDITOR_PLUGIN_HOVER_HIGHLIGHT_CLASS,
  EDITOR_PLUGIN_HOVER_PARENT,
  EDITOR_PLUGIN_CAPTION_BAR_CLASS,
  EDITOR_PLUGIN_HOVER_SHELL,
  EDITOR_PLUGIN_HOVER_VISIBLE,
  EDITOR_LAYOUT_ELEVATED_CLASS,
  EDITOR_PLUGIN_SURFACE_CLASS,
  EDITOR_TILE_DND_HANDLE,
  editorDndDragAttrs,
  editorDndDropAttrs,
  nestedContainerDisplayTitle,
} from "./editorChrome";

describe("editorChrome", () => {
  it("exports button lateral offset and other dashboard chrome constants (px)", () => {
    expect(EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX).toBe(5);
    expect(EDITOR_CHROME_TOP_OFFSET_PX).toBeGreaterThanOrEqual(0);
    expect(EDITOR_CHROME_TOP_OFFSET_PX).toBeLessThanOrEqual(32);
  });

  it("nestedContainerDisplayTitle includes the stable container id in the label", () => {
    expect(nestedContainerDisplayTitle("group-9-1777219109445")).toBe("Container: group-9-1777219109445");
  });

  it("exports tailwind group name for plugin hover parent", () => {
    expect(EDITOR_PLUGIN_HOVER_PARENT).toBe("group/editor-plugin");
  });

  it("EDITOR_PLUGIN_HOVER_SHELL bundles group + hover ring class for DashboardHost", () => {
    expect(EDITOR_PLUGIN_HOVER_HIGHLIGHT_CLASS).toBe("editor-plugin-hover-highlight");
    expect(EDITOR_PLUGIN_HOVER_SHELL).toBe("group/editor-plugin editor-plugin-hover-highlight");
  });

  it("EDITOR_PLUGIN_HOVER_VISIBLE wires named group and no-hover media", () => {
    expect(EDITOR_PLUGIN_HOVER_VISIBLE).toContain("group-hover/editor-plugin:opacity-100");
    expect(EDITOR_PLUGIN_HOVER_VISIBLE).toContain("[@media(hover:none)]");
  });

  it("surface class is stable for app.css :has() rules", () => {
    expect(EDITOR_PLUGIN_SURFACE_CLASS).toBe("editor-plugin-surface");
  });

  it("EDITOR_LAYOUT_ELEVATED_CLASS marks root shells for resting shadow", () => {
    expect(EDITOR_LAYOUT_ELEVATED_CLASS).toBe("editor-layout-elevated");
  });

  it("EDITOR_PLUGIN_CAPTION_BAR_CLASS is always-visible (no hover opacity) with a light-mode gray strip", () => {
    expect(EDITOR_PLUGIN_CAPTION_BAR_CLASS).not.toContain("opacity-0");
    expect(EDITOR_PLUGIN_CAPTION_BAR_CLASS).toContain("bg-slate-100");
    expect(EDITOR_PLUGIN_CAPTION_BAR_CLASS).toContain("dark:bg-gray-800");
  });

  it("exports sveltednd handle selectors and drag/drop class maps", () => {
    expect(CONTAINER_DND_HANDLE).toContain("editor-container-drag-handle");
    expect(EDITOR_TILE_DND_HANDLE).toContain("editor-tile-drag-handle");
    expect(editorDndDragAttrs.draggingClass).toContain("ring-primary-500");
    expect(editorDndDropAttrs.dragOverClass).toContain("svelte-dnd-drop-target");
  });
});
