/**
 * Kea palette **HTML5** drop on the editor chrome while in-grid reorder uses svelte-dnd-action.
 * Keeps `preventDefault` / preview logic out of `DashboardHost.svelte` so it stays testable.
 *
 * Callbacks are **getter** functions so Svelte 5 props stay reactive when the parent rebinds handlers.
 */

import { isPaletteFabricHtml5Drag, parsePaletteDrop } from "../../palette/paletteDragCodec";
import {
  findRootInsertIndexFromElementsFromPoint,
  shouldSuppressPaletteRootInsertPreview,
} from "../paletteDropInsertIndex";

export type PaletteRootInsertPreview = null | { kind: "before"; index: number } | { kind: "append" };

export type ElementsFromPointFn = (x: number, y: number) => readonly Element[];

export function defaultElementsFromPoint(clientX: number, clientY: number): Element[] {
  if (typeof document === "undefined" || typeof document.elementsFromPoint !== "function") {
    return [];
  }
  return [...document.elementsFromPoint(clientX, clientY)];
}

export type PaletteRootDropCallbacks = {
  getRootDndIds: () => readonly string[];
  setPreview: (p: PaletteRootInsertPreview) => void;
  getPreview: () => PaletteRootInsertPreview;
  getOnAddTile: () => ((pluginId: string, insertBeforeIndex?: number) => void) | undefined;
  getOnAddGroup: () => ((insertBeforeIndex?: number) => void) | undefined;
  getOnAddTileToGroup: () => ((groupId: string, pluginId: string) => void) | undefined;
  getOnAddGroupToGroup: () => ((parentGroupId: string) => void) | undefined;
};

export type PaletteRootDropController = {
  clearPreview: () => void;
  onCanvasDrop: (e: DragEvent) => void;
  onEditorChromeDragOver: (e: DragEvent) => void;
  onGroupPluginDragOver: (e: DragEvent) => void;
  onGroupPluginDrop: (e: DragEvent, groupId: string) => void;
};

export function createPaletteRootDropController(
  cb: PaletteRootDropCallbacks,
  elementsFromPointImpl: ElementsFromPointFn = defaultElementsFromPoint,
): PaletteRootDropController {
  function clearPreview() {
    if (cb.getPreview() !== null) cb.setPreview(null);
  }

  function onCanvasDrop(e: DragEvent) {
    e.preventDefault();
    clearPreview();
    const p = parsePaletteDrop(e.dataTransfer);
    if (!p) return;
    const rootIds = cb.getRootDndIds();
    const insertAt = findRootInsertIndexFromElementsFromPoint(
      e.clientX,
      e.clientY,
      rootIds,
      elementsFromPointImpl,
    );
    if (p.kind === "group") {
      cb.getOnAddGroup()?.(insertAt);
      return;
    }
    if (p.kind === "plugin") cb.getOnAddTile()?.(p.id, insertAt);
  }

  function onEditorChromeDragOver(e: DragEvent) {
    const dt = e.dataTransfer;
    if (!dt) return;
    if (!isPaletteFabricHtml5Drag(dt)) {
      clearPreview();
      return;
    }
    e.preventDefault();
    dt.dropEffect = "copy";
    const stack = [...elementsFromPointImpl(e.clientX, e.clientY)];
    if (shouldSuppressPaletteRootInsertPreview(stack)) {
      clearPreview();
      return;
    }
    const rootIds = cb.getRootDndIds();
    const insertAt = findRootInsertIndexFromElementsFromPoint(
      e.clientX,
      e.clientY,
      rootIds,
      elementsFromPointImpl,
    );
    cb.setPreview(insertAt === undefined ? { kind: "append" } : { kind: "before", index: insertAt });
  }

  function onGroupPluginDragOver(e: DragEvent) {
    const dt = e.dataTransfer;
    if (!dt) return;
    if (!isPaletteFabricHtml5Drag(dt)) return;
    e.preventDefault();
    dt.dropEffect = "copy";
    clearPreview();
  }

  function onGroupPluginDrop(e: DragEvent, groupId: string) {
    e.preventDefault();
    clearPreview();
    const p = parsePaletteDrop(e.dataTransfer);
    if (p?.kind === "plugin") {
      e.stopPropagation();
      cb.getOnAddTileToGroup()?.(groupId, p.id);
      return;
    }
    if (p?.kind === "group") {
      e.stopPropagation();
      cb.getOnAddGroupToGroup()?.(groupId);
    }
  }

  return { clearPreview, onCanvasDrop, onEditorChromeDragOver, onGroupPluginDragOver, onGroupPluginDrop };
}
