import { describe, expect, it, vi } from "vitest";

import { DASHBOARD_EDITOR_ATTR } from "./editorDomContract";
import {
  createPaletteRootDropController,
  defaultElementsFromPoint,
  type PaletteRootInsertPreview,
} from "./editorPaletteRootDrop";

describe("defaultElementsFromPoint", () => {
  it("returns empty when elementsFromPoint is missing", () => {
    const orig = document.elementsFromPoint;
    Object.defineProperty(document, "elementsFromPoint", { value: undefined, configurable: true });
    expect(defaultElementsFromPoint(0, 0)).toEqual([]);
    Object.defineProperty(document, "elementsFromPoint", { value: orig, configurable: true });
  });

  it("delegates to document.elementsFromPoint when available", () => {
    const spy = vi.spyOn(document, "elementsFromPoint").mockReturnValue([document.body] as unknown as Element[]);
    expect(defaultElementsFromPoint(3, 4)).toEqual([document.body]);
    expect(spy).toHaveBeenCalledWith(3, 4);
    spy.mockRestore();
  });
});

describe("createPaletteRootDropController", () => {
  it("onCanvasDrop parses plugin drop and calls onAddTile with insert index", () => {
    let preview: PaletteRootInsertPreview = { kind: "before", index: 0 };
    const onAddTile = vi.fn();
    const c = createPaletteRootDropController(
      {
        getRootDndIds: () => ["a", "b"],
        getPreview: () => preview,
        setPreview: (p) => {
          preview = p;
        },
        getOnAddTile: () => onAddTile,
        getOnAddGroup: () => undefined,
        getOnAddTileToGroup: () => undefined,
        getOnAddGroupToGroup: () => undefined,
      },
      () => [],
    );
    const dt = {
      getData: (mime: string) => (mime === "application/x-kea-plugin-id" ? "p1" : ""),
    } as unknown as DataTransfer;
    const ev = { preventDefault: vi.fn(), clientX: 0, clientY: 0, dataTransfer: dt } as unknown as DragEvent;
    c.onCanvasDrop(ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(preview).toBe(null);
    expect(onAddTile).toHaveBeenCalledWith("p1", undefined);
  });

  it("onCanvasDrop calls onAddGroup for add-group payload", () => {
    let preview: PaletteRootInsertPreview = null;
    const onAddGroup = vi.fn();
    const c = createPaletteRootDropController({
      getRootDndIds: () => [],
      getPreview: () => preview,
      setPreview: (p) => {
        preview = p;
      },
      getOnAddTile: () => undefined,
      getOnAddGroup: () => onAddGroup,
      getOnAddTileToGroup: () => undefined,
      getOnAddGroupToGroup: () => undefined,
    });
    const dt = {
      getData: (mime: string) => (mime === "application/x-kea-fabric-layout-dnd" ? "add-group" : ""),
    } as unknown as DataTransfer;
    const ev = { preventDefault: vi.fn(), clientX: 0, clientY: 0, dataTransfer: dt } as unknown as DragEvent;
    c.onCanvasDrop(ev);
    expect(onAddGroup).toHaveBeenCalledWith(undefined);
  });

  it("onEditorChromeDragOver clears preview when not a palette drag", () => {
    let preview: PaletteRootInsertPreview = { kind: "append" };
    const c = createPaletteRootDropController({
      getRootDndIds: () => [],
      getPreview: () => preview,
      setPreview: (p) => {
        preview = p;
      },
      getOnAddTile: () => undefined,
      getOnAddGroup: () => undefined,
      getOnAddTileToGroup: () => undefined,
      getOnAddGroupToGroup: () => undefined,
    });
    const ev = {
      preventDefault: vi.fn(),
      dataTransfer: { types: ["Files"] },
    } as unknown as DragEvent;
    c.onEditorChromeDragOver(ev);
    expect(preview).toBe(null);
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  it("onEditorChromeDragOver returns early when dataTransfer is null", () => {
    let preview: PaletteRootInsertPreview = { kind: "append" };
    const c = createPaletteRootDropController({
      getRootDndIds: () => [],
      getPreview: () => preview,
      setPreview: (p) => {
        preview = p;
      },
      getOnAddTile: () => undefined,
      getOnAddGroup: () => undefined,
      getOnAddTileToGroup: () => undefined,
      getOnAddGroupToGroup: () => undefined,
    });
    const ev = { preventDefault: vi.fn(), dataTransfer: null } as unknown as DragEvent;
    c.onEditorChromeDragOver(ev);
    expect(preview).toEqual({ kind: "append" });
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  it("onGroupPluginDragOver returns early when dataTransfer is null", () => {
    const c = createPaletteRootDropController({
      getRootDndIds: () => [],
      getPreview: () => null,
      setPreview: () => {},
      getOnAddTile: () => undefined,
      getOnAddGroup: () => undefined,
      getOnAddTileToGroup: () => undefined,
      getOnAddGroupToGroup: () => undefined,
    });
    const ev = { preventDefault: vi.fn(), dataTransfer: null } as unknown as DragEvent;
    c.onGroupPluginDragOver(ev);
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  it("onGroupPluginDrop forwards plugin to onAddTileToGroup", () => {
    let preview: PaletteRootInsertPreview = null;
    const onAddTileToGroup = vi.fn();
    const c = createPaletteRootDropController({
      getRootDndIds: () => [],
      getPreview: () => preview,
      setPreview: (p) => {
        preview = p;
      },
      getOnAddTile: () => undefined,
      getOnAddGroup: () => undefined,
      getOnAddTileToGroup: () => onAddTileToGroup,
      getOnAddGroupToGroup: () => undefined,
    });
    const stopPropagation = vi.fn();
    const dt = {
      getData: (mime: string) => (mime === "application/x-kea-plugin-id" ? "p9" : ""),
    } as unknown as DataTransfer;
    const ev = {
      preventDefault: vi.fn(),
      stopPropagation,
      dataTransfer: dt,
    } as unknown as DragEvent;
    c.onGroupPluginDrop(ev, "g1");
    expect(onAddTileToGroup).toHaveBeenCalledWith("g1", "p9");
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("onGroupPluginDrop forwards group to onAddGroupToGroup", () => {
    const onAddGroupToGroup = vi.fn();
    const c = createPaletteRootDropController({
      getRootDndIds: () => [],
      getPreview: () => null,
      setPreview: () => {},
      getOnAddTile: () => undefined,
      getOnAddGroup: () => undefined,
      getOnAddTileToGroup: () => undefined,
      getOnAddGroupToGroup: () => onAddGroupToGroup,
    });
    const stopPropagation = vi.fn();
    const dt = {
      getData: (mime: string) => (mime === "application/x-kea-fabric-layout-dnd" ? "add-group" : ""),
    } as unknown as DataTransfer;
    const ev = {
      preventDefault: vi.fn(),
      stopPropagation,
      dataTransfer: dt,
    } as unknown as DragEvent;
    c.onGroupPluginDrop(ev, "parent");
    expect(onAddGroupToGroup).toHaveBeenCalledWith("parent");
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("clearPreview is a no-op when preview is already null", () => {
    const setPreview = vi.fn();
    const c = createPaletteRootDropController({
      getRootDndIds: () => [],
      getPreview: () => null,
      setPreview,
      getOnAddTile: () => undefined,
      getOnAddGroup: () => undefined,
      getOnAddTileToGroup: () => undefined,
      getOnAddGroupToGroup: () => undefined,
    });
    c.clearPreview();
    expect(setPreview).not.toHaveBeenCalled();
  });

  it("onEditorChromeDragOver clears preview when root insert preview is suppressed", () => {
    let preview: PaletteRootInsertPreview = { kind: "before", index: 0 };
    const zone = document.createElement("div");
    zone.setAttribute(DASHBOARD_EDITOR_ATTR, "drop-zone");
    const group = document.createElement("div");
    group.setAttribute(DASHBOARD_EDITOR_ATTR, "tile-row");
    group.setAttribute("data-editor-group", "true");
    const inner = document.createElement("span");
    group.appendChild(inner);
    zone.appendChild(group);
    const c = createPaletteRootDropController(
      {
        getRootDndIds: () => ["g"],
        getPreview: () => preview,
        setPreview: (p) => {
          preview = p;
        },
        getOnAddTile: () => undefined,
        getOnAddGroup: () => undefined,
        getOnAddTileToGroup: () => undefined,
        getOnAddGroupToGroup: () => undefined,
      },
      () => [inner],
    );
    const ev = {
      preventDefault: vi.fn(),
      clientX: 1,
      clientY: 1,
      dataTransfer: {
        types: ["application/x-kea-plugin-id"],
        dropEffect: "none",
      },
    } as unknown as DragEvent;
    c.onEditorChromeDragOver(ev);
    expect(preview).toBe(null);
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it("onGroupPluginDragOver prevents default for palette drags", () => {
    let preview: PaletteRootInsertPreview = { kind: "before", index: 1 };
    const c = createPaletteRootDropController({
      getRootDndIds: () => [],
      getPreview: () => preview,
      setPreview: (p) => {
        preview = p;
      },
      getOnAddTile: () => undefined,
      getOnAddGroup: () => undefined,
      getOnAddTileToGroup: () => undefined,
      getOnAddGroupToGroup: () => undefined,
    });
    const ev = {
      preventDefault: vi.fn(),
      dataTransfer: {
        types: ["application/x-kea-plugin-id"],
        dropEffect: "none",
      },
    } as unknown as DragEvent;
    c.onGroupPluginDragOver(ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(preview).toBe(null);
  });

  it("onEditorChromeDragOver sets append preview when geometry says append", () => {
    let preview: PaletteRootInsertPreview = null;
    const zone = document.createElement("div");
    zone.setAttribute(DASHBOARD_EDITOR_ATTR, "drop-zone");
    const c = createPaletteRootDropController(
      {
        getRootDndIds: () => ["x"],
        getPreview: () => preview,
        setPreview: (p) => {
          preview = p;
        },
        getOnAddTile: () => undefined,
        getOnAddGroup: () => undefined,
        getOnAddTileToGroup: () => undefined,
        getOnAddGroupToGroup: () => undefined,
      },
      () => [zone],
    );
    const ev = {
      preventDefault: vi.fn(),
      clientX: 1,
      clientY: 1,
      dataTransfer: {
        types: ["application/x-kea-plugin-id"],
        dropEffect: "none",
      },
    } as unknown as DragEvent;
    c.onEditorChromeDragOver(ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(preview).toEqual({ kind: "append" });
  });
});
