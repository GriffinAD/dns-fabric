import type { DashboardGroup } from "../types";

function seedSectionPanel(tabLabel: string, idPrefix: string): DashboardGroup {
  return {
    kind: "group",
    id: `${idPrefix}-${Date.now()}`,
    showBorder: true,
    tabLabel,
    children: [],
  };
}

/** Empty tab container with one nested panel tab (ADR-0054). */
export function makeTabControlGroup(id: string): DashboardGroup {
  const firstTab = seedSectionPanel("Tab 1", "tab-pane");
  return {
    kind: "group",
    id,
    showBorder: true,
    hostControl: "tab-control",
    innerWrap: false,
    hostState: { activeChildId: firstTab.id },
    children: [firstTab],
  };
}

/** Collapsible vertical stack with one empty section. */
export function makeVerticalStackGroup(id: string): DashboardGroup {
  const first = seedSectionPanel("Section 1", "stack-section");
  return {
    kind: "group",
    id,
    showBorder: true,
    hostControl: "vertical-stack",
    innerWrap: false,
    children: [first],
  };
}
