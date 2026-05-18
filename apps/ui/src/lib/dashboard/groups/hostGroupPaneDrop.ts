import {
  groupAppendContainer,
  groupCanvasContainer,
  groupChildSlotContainer,
  groupEmptyContainer,
} from "../interactions/dashboardSveltedndTypes";
import { findGroupByIdInItems } from "../layout/layoutTree";
import type { DashboardGroup, GroupChild, RootLayoutItem } from "../types";
import { isDashboardGroupNode } from "../types";

/** Nested panel tab/section with no content yet — palette drops fill this group. */
export function isEmptyHostPaneGroup(child: GroupChild): child is DashboardGroup {
  return (
    isDashboardGroupNode(child) &&
    child.children.length === 0 &&
    child.hostControl !== "tab-control" &&
    child.hostControl !== "vertical-stack"
  );
}

export type HostPaletteChildDrop = "fill-pane" | "append-host-slot";

/** sveltednd container id for the active tab/section body in edit mode. */
export function hostGroupPaneDropContainer(
  hostGroupId: string,
  child: GroupChild,
): string {
  if (isDashboardGroupNode(child)) {
    return isEmptyHostPaneGroup(child) ? groupEmptyContainer(child.id) : groupCanvasContainer(child.id);
  }
  return groupChildSlotContainer(hostGroupId, child.id);
}

export function hostGroupAppendDropContainer(hostGroupId: string): string {
  return groupAppendContainer(hostGroupId);
}

export function resolveHostPaletteChildDrop(
  layoutItems: RootLayoutItem[],
  hostGroupId: string,
  childId: string,
): HostPaletteChildDrop {
  const host = findGroupByIdInItems(layoutItems, hostGroupId);
  if (!host) return "append-host-slot";
  const child = host.children.find((c) => c.id === childId);
  if (!child) return "append-host-slot";
  return isEmptyHostPaneGroup(child) ? "fill-pane" : "append-host-slot";
}
