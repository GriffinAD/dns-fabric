import { describe, expect, it } from "vitest";

import {
  DASHBOARD_EDITOR_ATTR,
  EDITOR_DROP_ZONE_SEL,
  dashboardEditorSurfaceSelector,
  isDashboardEditorTileRow,
} from "./editorDomContract";

describe("editorDomContract", () => {
  it("dashboardEditorSurfaceSelector matches the attribute contract", () => {
    expect(dashboardEditorSurfaceSelector("drop-zone")).toBe(`[${DASHBOARD_EDITOR_ATTR}="drop-zone"]`);
    expect(EDITOR_DROP_ZONE_SEL).toBe(`[${DASHBOARD_EDITOR_ATTR}="drop-zone"]`);
  });

  it("isDashboardEditorTileRow is true only for tile-row surface", () => {
    const el = document.createElement("div");
    el.setAttribute(DASHBOARD_EDITOR_ATTR, "tile-row");
    expect(isDashboardEditorTileRow(el)).toBe(true);
    el.setAttribute(DASHBOARD_EDITOR_ATTR, "drop-zone");
    expect(isDashboardEditorTileRow(el)).toBe(false);
  });
});
