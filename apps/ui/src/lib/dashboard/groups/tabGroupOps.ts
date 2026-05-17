import type { DisplayMode } from "../../api/types";
import type { DashboardGroup, DashboardTile, GroupChild } from "../types";
import { MAX_TAB_GROUP_CHILDREN } from "../types";

export type AddTabChildOpts = {
  pluginId: string;
  tabLabel: string;
  displayMode?: DisplayMode;
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

export function addTabChild(group: DashboardGroup, opts: AddTabChildOpts): DashboardGroup {
  assertTabControlGroup(group);
  if (group.children.length >= MAX_TAB_GROUP_CHILDREN) {
    throw new Error(`tab-control group has the maximum of ${MAX_TAB_GROUP_CHILDREN} tabs`);
  }
  const ids = childIds(group.children);
  const id = uniqueChildId(`tab-${opts.pluginId.replace(/[^a-z0-9]+/gi, "-")}`, ids);
  const tile: DashboardTile = {
    id,
    pluginId: opts.pluginId,
    tabLabel: opts.tabLabel,
    hostControl: "single-panel",
    displayMode: opts.displayMode ?? "full",
  };
  const children = [...group.children, tile];
  return withChildren(group, children, { hostState: { activeChildId: id } });
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
  const id = opts.id ?? uniqueChildId("tab-group", ids);
  if (ids.has(id)) {
    throw new Error(`tab child id already exists: ${id}`);
  }
  const nested: DashboardGroup = {
    kind: "group",
    id,
    showBorder: true,
    hostControl: "tab-control",
    tabLabel: opts.tabLabel ?? "Tabs",
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
