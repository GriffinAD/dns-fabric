import type { DashboardGroup, DashboardTile, GroupChild } from "../types";
import { isDashboardGroupNode, MAX_TAB_GROUP_CHILDREN } from "../types";

/** Tab strip label; defaults to child `id` (ADR-0054). */
export function tabStripLabel(child: GroupChild): string {
  return child.tabLabel ?? child.id;
}

/** Active tab child; falls back to first child when `activeChildId` is missing or stale. */
export function activeTabChild(group: DashboardGroup): GroupChild | undefined {
  const children = group.children;
  if (children.length === 0) return undefined;
  const active = group.hostState?.activeChildId;
  if (active != null && children.some((c) => c.id === active)) {
    return children.find((c) => c.id === active);
  }
  return children[0];
}

export type AddTabChildOpts = {
  pluginId: string;
  tabLabel: string;
};

export type AddTabContainerOpts = {
  tabLabel?: string;
  id?: string;
};

function assertTabControlGroup(group: DashboardGroup): void {
  if (group.hostControl !== "tab-control") {
    throw new Error("group is not a tab-control container");
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

function resolveActiveChildId(
  children: GroupChild[],
  hostState: DashboardGroup["hostState"],
  removedId?: string,
): DashboardGroup["hostState"] {
  /* c8 ignore next -- tab-control groups retain ≥1 child via removeTabChild */
  if (children.length === 0) return undefined;
  const active = hostState?.activeChildId;
  if (
    active != null &&
    active !== removedId &&
    children.some((c) => c.id === active)
  ) {
    return { activeChildId: active };
  }
  return { activeChildId: children[0]!.id };
}

type WithChildrenOpts = {
  hostState?: DashboardGroup["hostState"];
  removedId?: string;
};

function withChildren(
  group: DashboardGroup,
  children: GroupChild[],
  opts?: WithChildrenOpts,
): DashboardGroup {
  return {
    ...group,
    children,
    hostState:
      opts?.hostState ??
      resolveActiveChildId(children, group.hostState, opts?.removedId),
  };
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
    throw new Error(`tab child not found: ${childId}`);
  }
  return { ...group, children };
}

/** Each tab is a panel group (container surface); plugin tiles live inside the pane. */
export function wrapTabTileInPaneGroup(tile: DashboardTile): DashboardGroup {
  return {
    kind: "group",
    id: tile.id,
    showBorder: true,
    tabLabel: tile.tabLabel,
    children: [tile],
  };
}

/** Tab panes fill the host panel; strip `grid` on pane groups is not used for layout. */
function clearTabPaneStripGrid(pane: DashboardGroup): { child: DashboardGroup; changed: boolean } {
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

/** Legacy layouts may store a plugin tile as the tab child; upgrade to a pane group. */
export function normalizeTabChildPaneGroups(group: DashboardGroup): DashboardGroup {
  assertTabControlGroup(group);
  let changed = false;
  const children = group.children.map((child) => {
    if (!isDashboardGroupNode(child)) {
      changed = true;
      return wrapTabTileInPaneGroup(child);
    }
    const cleared = clearTabPaneStripGrid(child);
    if (cleared.changed) changed = true;
    return cleared.child;
  });
  return changed ? withChildren(group, children) : group;
}

export function addTabChild(group: DashboardGroup, opts: AddTabChildOpts): DashboardGroup {
  assertTabControlGroup(group);
  if (group.children.length >= MAX_TAB_GROUP_CHILDREN) {
    throw new Error(`tab-control group has the maximum of ${MAX_TAB_GROUP_CHILDREN} tabs`);
  }
  const ids = childIds(group.children);
  const paneId = uniqueChildId(
    `tab-pane-${opts.pluginId.replace(/[^a-z0-9]+/gi, "-")}`,
    ids,
  );
  const pane: DashboardGroup = {
    kind: "group",
    id: paneId,
    showBorder: true,
    tabLabel: opts.tabLabel,
    children: [],
  };
  const children = [...group.children, pane];
  return withChildren(group, children, { hostState: { activeChildId: paneId } });
}

export function addTabContainer(
  group: DashboardGroup,
  opts: AddTabContainerOpts = {},
): DashboardGroup {
  assertTabControlGroup(group);
  if (group.children.length >= MAX_TAB_GROUP_CHILDREN) {
    throw new Error(`tab-control group has the maximum of ${MAX_TAB_GROUP_CHILDREN} tabs`);
  }
  const ids = childIds(group.children);
  const id = opts.id ?? uniqueChildId("tab-pane", ids);
  if (ids.has(id)) {
    throw new Error(`tab child id already exists: ${id}`);
  }
  const nested: DashboardGroup = {
    kind: "group",
    id,
    showBorder: true,
    tabLabel: opts.tabLabel ?? `Tab ${group.children.length + 1}`,
    children: [],
  };
  const children = [...group.children, nested];
  return withChildren(group, children, { hostState: { activeChildId: id } });
}

export function removeTabChild(group: DashboardGroup, childId: string): DashboardGroup {
  assertTabControlGroup(group);
  if (group.children.length <= 1) {
    throw new Error("cannot remove the last tab from a tab-control group");
  }
  const children = group.children.filter((c) => c.id !== childId);
  if (children.length === group.children.length) {
    throw new Error(`tab child not found: ${childId}`);
  }
  return withChildren(group, children, { removedId: childId });
}

export function renameTabChild(
  group: DashboardGroup,
  childId: string,
  tabLabel: string,
): DashboardGroup {
  assertTabControlGroup(group);
  return mapChild(group, childId, (child) => ({ ...child, tabLabel }));
}

export function reorderTabChildren(
  group: DashboardGroup,
  orderedIds: string[],
): DashboardGroup {
  assertTabControlGroup(group);
  if (orderedIds.length !== group.children.length) {
    throw new Error("orderedIds must include every tab child id exactly once");
  }
  const byId = new Map(group.children.map((c) => [c.id, c]));
  const children = orderedIds.map((id) => {
    const child = byId.get(id);
    if (!child) throw new Error(`tab child not found: ${id}`);
    return child;
  });
  return { ...group, children };
}

export function setActiveTab(group: DashboardGroup, childId: string): DashboardGroup {
  assertTabControlGroup(group);
  if (!group.children.some((c) => c.id === childId)) {
    throw new Error(`tab child not found: ${childId}`);
  }
  return {
    ...group,
    hostState: { ...group.hostState, activeChildId: childId },
  };
}
