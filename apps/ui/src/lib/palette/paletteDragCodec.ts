/**
 * Single codec for palette HTML5 drag payloads (MIME + `text/plain` fallbacks).
 * Treat `DataTransfer` as untrusted input — reject unknown kinds and oversized strings.
 */
import type { PaletteDrop } from "./types";

export const DND_PLUGIN_MIME = "application/x-kea-plugin-id";
export const DND_LAYOUT_DND = "application/x-kea-fabric-layout-dnd";
export const DND_ADD_GROUP = "add-group";
export const PLAIN_ADD_GROUP = "x-kea-fabric:layout-add-group";
export const PLAIN_PLUGIN_PREFIX = "x-kea-fabric:plugin:";
const MAX_PLUGIN_ID_LEN = 256;

/** Parse palette-originated drag data; returns `null` for unknown or invalid payloads. */
export function parsePaletteDrop(dt: DataTransfer | null): PaletteDrop | null {
  if (!dt) return null;
  if (dt.getData(DND_LAYOUT_DND) === DND_ADD_GROUP) return { kind: "group" };
  const mimeP = dt.getData(DND_PLUGIN_MIME).trim();
  if (mimeP) {
    if (mimeP.length > MAX_PLUGIN_ID_LEN) return null;
    return { kind: "plugin", id: mimeP };
  }
  const plain = dt.getData("text/plain").trim();
  if (plain === PLAIN_ADD_GROUP) return { kind: "group" };
  if (plain.startsWith(PLAIN_PLUGIN_PREFIX)) {
    const id = plain.slice(PLAIN_PLUGIN_PREFIX.length);
    if (!id || id.length > MAX_PLUGIN_ID_LEN) return null;
    return { kind: "plugin", id };
  }
  return null;
}

export function setPalettePluginDragData(e: DragEvent, pluginId: string): void {
  if (pluginId.length > MAX_PLUGIN_ID_LEN) return;
  const t = `${PLAIN_PLUGIN_PREFIX}${pluginId}`;
  e.dataTransfer?.setData("text/plain", t);
  e.dataTransfer?.setData(DND_PLUGIN_MIME, pluginId);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
}

export function setPaletteAddGroupDragData(e: DragEvent): void {
  e.dataTransfer?.setData("text/plain", PLAIN_ADD_GROUP);
  e.dataTransfer?.setData(DND_LAYOUT_DND, DND_ADD_GROUP);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
}
