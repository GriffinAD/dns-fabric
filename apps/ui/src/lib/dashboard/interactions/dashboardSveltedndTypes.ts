/**
 * JSON-safe drag payloads for @thisux/sveltednd (HTML5 path stringifies dragData).
 * @see docs/planning/DASHBOARD_LAYOUT_DND.md
 */
export type DashboardDragPayload =
  | { k: "pp"; i: string }
  | { k: "pg" }
  | { k: "cr"; i: string }
  | { k: "cg"; g: string; i: string };

export function palettePluginPayload(pluginId: string): DashboardDragPayload {
  return { k: "pp", i: pluginId };
}

export function paletteAddGroupPayload(): DashboardDragPayload {
  return { k: "pg" };
}

/** Per-plugin palette source id so sveltednd does not treat all chips as one reorderable list. */
export function palettePluginContainer(pluginId: string): string {
  return `palette:p:${pluginId}`;
}

export const PALETTE_ADD_GROUP_CONTAINER = "palette:add-group";

export function rootCellPayload(id: string): DashboardDragPayload {
  return { k: "cr", i: id };
}

export function groupCellPayload(groupId: string, childId: string): DashboardDragPayload {
  return { k: "cg", g: groupId, i: childId };
}

/** Root row slot (before/after relative to this row). */
export function rootSlotContainer(id: string): string {
  return `r:${id}`;
}

/** Root row-end whitespace slot (always treated as "after target"). */
export function rootRowEndContainer(id: string): string {
  return `r:end:${id}`;
}

export const ROOT_EMPTY_CONTAINER = "r:__empty__";

/** Full-grid canvas behind tiles (blank cells and gaps). */
export const ROOT_CANVAS_CONTAINER = "r:__canvas__";

/** Below the last row — append a new row when dropping in bottom padding. */
export const ROOT_APPEND_CONTAINER = "r:__append__";

/** Empty horizontal gap to the right of a tile on the same row. */
export function rootGapAfterContainer(tileId: string): string {
  return `r:gap:${tileId}`;
}

export function rootAppendContainer(): string {
  return ROOT_APPEND_CONTAINER;
}

export function rootCanvasContainer(): string {
  return ROOT_CANVAS_CONTAINER;
}

export function groupChildSlotContainer(groupId: string, childId: string): string {
  return `g:${groupId}:c:${childId}`;
}

export function groupEmptyContainer(groupId: string): string {
  return `g:${groupId}:empty`;
}

/** Blank flex space inside a container (same role as root canvas). */
export function groupCanvasContainer(groupId: string): string {
  return `g:${groupId}:canvas`;
}

/** Horizontal gap after a child in a container strip / wrap row. */
export function groupGapAfterContainer(groupId: string, childId: string): string {
  return `g:${groupId}:gap:${childId}`;
}

/** End of a nowrap container strip — append after last child. */
export function groupAppendContainer(groupId: string): string {
  return `g:${groupId}:append`;
}

export type ParsedDropSlot =
  | { kind: "root"; id: string }
  | { kind: "rootRowEnd"; id: string }
  | { kind: "rootGapAfter"; id: string }
  | { kind: "rootEmpty" }
  | { kind: "rootCanvas" }
  | { kind: "rootAppend" }
  | { kind: "groupChild"; groupId: string; childId: string }
  | { kind: "groupEmpty"; groupId: string }
  | { kind: "groupCanvas"; groupId: string }
  | { kind: "groupGapAfter"; groupId: string; childId: string }
  | { kind: "groupAppend"; groupId: string };

export function parseDropContainer(container: string | null): ParsedDropSlot | null {
  if (!container) return null;
  if (container === ROOT_EMPTY_CONTAINER || container === ROOT_CANVAS_CONTAINER) {
    return container === ROOT_CANVAS_CONTAINER ? { kind: "rootCanvas" } : { kind: "rootEmpty" };
  }
  if (container === ROOT_APPEND_CONTAINER) return { kind: "rootAppend" };
  if (container.startsWith("r:gap:")) {
    const id = container.slice("r:gap:".length);
    if (!id) return null;
    return { kind: "rootGapAfter", id };
  }
  if (container.startsWith("r:end:")) {
    const id = container.slice("r:end:".length);
    if (!id) return null;
    return { kind: "rootRowEnd", id };
  }
  if (container.startsWith("r:")) {
    const id = container.slice(2);
    if (!id) return null;
    return { kind: "root", id };
  }
  if (container.endsWith(":append")) {
    const m = /^g:([^:]+):append$/.exec(container);
    if (!m?.[1]) return null;
    return { kind: "groupAppend", groupId: m[1] };
  }
  if (container.includes(":gap:")) {
    const m = /^g:([^:]+):gap:(.+)$/.exec(container);
    if (!m?.[1] || !m[2]) return null;
    return { kind: "groupGapAfter", groupId: m[1], childId: m[2] };
  }
  if (container.endsWith(":canvas")) {
    const m = /^g:([^:]+):canvas$/.exec(container);
    if (!m?.[1]) return null;
    return { kind: "groupCanvas", groupId: m[1] };
  }
  if (container.endsWith(":empty")) {
    const m = /^g:([^:]+):empty$/.exec(container);
    if (!m?.[1]) return null;
    return { kind: "groupEmpty", groupId: m[1] };
  }
  const m = /^g:([^:]+):c:(.+)$/.exec(container);
  if (!m?.[1] || !m[2]) return null;
  return { kind: "groupChild", groupId: m[1], childId: m[2] };
}

/** Coerce unknown (e.g. post-JSON.parse) into DashboardDragPayload or null. */
export function parseDragPayload(raw: unknown): DashboardDragPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.k === "pp" && typeof o.i === "string") return { k: "pp", i: o.i };
  if (o.k === "pg") return { k: "pg" };
  if (o.k === "cr" && typeof o.i === "string") return { k: "cr", i: o.i };
  if (o.k === "cg" && typeof o.g === "string" && typeof o.i === "string") return { k: "cg", g: o.g, i: o.i };
  return null;
}
