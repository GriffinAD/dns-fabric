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

export function groupChildSlotContainer(groupId: string, childId: string): string {
  return `g:${groupId}:c:${childId}`;
}

export function groupEmptyContainer(groupId: string): string {
  return `g:${groupId}:empty`;
}

export type ParsedDropSlot =
  | { kind: "root"; id: string }
  | { kind: "rootRowEnd"; id: string }
  | { kind: "rootEmpty" }
  | { kind: "groupChild"; groupId: string; childId: string }
  | { kind: "groupEmpty"; groupId: string };

export function parseDropContainer(container: string | null): ParsedDropSlot | null {
  if (!container) return null;
  if (container === ROOT_EMPTY_CONTAINER) return { kind: "rootEmpty" };
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
