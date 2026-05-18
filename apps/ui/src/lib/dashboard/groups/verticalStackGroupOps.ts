import type { DashboardGroup, DashboardTile, GroupChild } from "../types";
import { isDashboardGroupNode, MAX_TAB_GROUP_CHILDREN } from "../types";
import { tabStripLabel, wrapTabTileInPaneGroup } from "./tabGroupOps";

export const MAX_STACK_GROUP_CHILDREN = MAX_TAB_GROUP_CHILDREN;

export function stackSectionLabel(child: GroupChild): string {
  return tabStripLabel(child);
}

export type AddStackChildOpts = {
  pluginId: string;
  sectionLabel: string;
};

export type AddStackSectionOpts = {
  sectionLabel?: string;
  id?: string;
};

function assertVerticalStackGroup(group: DashboardGroup): void {
  if (group.hostControl !== "vertical-stack") {
    throw new Error("group is not a vertical-stack container");
  }
}

function childIds(children: GroupChild[]): Set<string> {
  return new Set(children.map((c) => c.id));
}

function uniqueChildId(prefix: string, existing: Set<string>): string {
  let id = `${prefix}-${Date.now()}`;
  let n = 0;
  while (existing.has(id)) {
    id = `${prefix}-${Date.now()}-${++n}`;
  }
  return id;
}

function collapsedSet(group: DashboardGroup): Set<string> {
  return new Set(group.hostState?.collapsedChildIds ?? []);
}

function withChildren(group: DashboardGroup, children: GroupChild[]): DashboardGroup {
  return { ...group, children };
}

function mapChild(
  group: DashboardGroup,
  childId: string,
  fn: (child: GroupChild) => GroupChild,
): DashboardGroup {
  let found = false;
  const children = group.children.map((c) => {
    if (c.id !== childId) return c;
    found = true;
    return fn(c);
  });
  if (!found) {
    throw new Error(`stack section not found: ${childId}`);
  }
  return { ...group, children };
}

/** Stack section panes are not nowrap-strip siblings; strip `grid` on pane groups is vestigial. */
function clearStackPaneStripGrid(pane: DashboardGroup): { child: DashboardGroup; changed: boolean } {
  if (
    pane.hostControl === "tab-control" ||
    pane.hostControl === "vertical-stack" ||
    pane.grid == null
  ) {
    return { child: pane, changed: false };
  }
  const { grid: _grid, ...rest } = pane;
  return { child: rest, changed: true };
}

/** Legacy layouts may store a plugin tile as the section child; upgrade to a pane group. */
export function normalizeStackChildPaneGroups(group: DashboardGroup): DashboardGroup {
  assertVerticalStackGroup(group);
  let changed = false;
  const children = group.children.map((child) => {
    if (!isDashboardGroupNode(child)) {
      changed = true;
      return wrapTabTileInPaneGroup(child);
    }
    const cleared = clearStackPaneStripGrid(child);
    if (cleared.changed) changed = true;
    return cleared.child;
  });
  return changed ? withChildren(group, children) : group;
}

export function isStackSectionCollapsed(group: DashboardGroup, childId: string): boolean {
  return collapsedSet(group).has(childId);
}

export function toggleStackSectionCollapsed(
  group: DashboardGroup,
  childId: string,
): DashboardGroup {
  assertVerticalStackGroup(group);
  if (!group.children.some((c) => c.id === childId)) {
    throw new Error(`stack section not found: ${childId}`);
  }
  const next = collapsedSet(group);
  if (next.has(childId)) next.delete(childId);
  else next.add(childId);
  return {
    ...group,
    hostState: {
      ...group.hostState,
      collapsedChildIds: [...next],
    },
  };
}

/** Palette append on the stack strip: new empty section pane labelled after the plugin. */
export function addStackChild(group: DashboardGroup, opts: AddStackChildOpts): DashboardGroup {
  assertVerticalStackGroup(group);
  if (group.children.length >= MAX_STACK_GROUP_CHILDREN) {
    throw new Error(`vertical-stack group has the maximum of ${MAX_STACK_GROUP_CHILDREN} sections`);
  }
  const ids = childIds(group.children);
  const paneId = uniqueChildId(
    `stack-pane-${opts.pluginId.replace(/[^a-z0-9]+/gi, "-")}`,
    ids,
  );
  const pane: DashboardGroup = {
    kind: "group",
    id: paneId,
    showBorder: true,
    tabLabel: opts.sectionLabel,
    children: [],
  };
  return withChildren(group, [...group.children, pane]);
}

/** Append an empty section pane (container surface inside the stack). */
export function addStackSection(
  group: DashboardGroup,
  opts: AddStackSectionOpts = {},
): DashboardGroup {
  assertVerticalStackGroup(group);
  if (group.children.length >= MAX_STACK_GROUP_CHILDREN) {
    throw new Error(`vertical-stack group has the maximum of ${MAX_STACK_GROUP_CHILDREN} sections`);
  }
  const ids = childIds(group.children);
  const id = opts.id ?? uniqueChildId("stack-section", ids);
  if (ids.has(id)) {
    throw new Error(`stack section id already exists: ${id}`);
  }
  const nested: DashboardGroup = {
    kind: "group",
    id,
    showBorder: true,
    tabLabel: opts.sectionLabel ?? `Section ${group.children.length + 1}`,
    children: [],
  };
  return withChildren(group, [...group.children, nested]);
}

export function removeStackChild(group: DashboardGroup, childId: string): DashboardGroup {
  assertVerticalStackGroup(group);
  if (group.children.length <= 1) {
    throw new Error("cannot remove the last section from a vertical-stack group");
  }
  const children = group.children.filter((c) => c.id !== childId);
  if (children.length === group.children.length) {
    throw new Error(`stack section not found: ${childId}`);
  }
  const collapsed = (group.hostState?.collapsedChildIds ?? []).filter((id) => id !== childId);
  return {
    ...group,
    children,
    hostState: {
      ...group.hostState,
      collapsedChildIds: collapsed.length > 0 ? collapsed : undefined,
    },
  };
}

export function renameStackChild(
  group: DashboardGroup,
  childId: string,
  sectionLabel: string,
): DashboardGroup {
  assertVerticalStackGroup(group);
  return mapChild(group, childId, (child) => ({ ...child, tabLabel: sectionLabel }));
}
