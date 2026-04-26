/**
 * Stable **host DOM contract** for the dashboard layout editor (`DashboardHost`).
 * Palette hit-testing and root insert geometry (`paletteDropInsertIndex`) resolve surfaces via
 * `data-dashboard-editor="…"`, not `data-testid` alone — testids remain for Playwright and humans.
 *
 * @see docs/architecture/dashboard-plugin-blueprint.md — “Host DOM contract (layout editor)”
 */

export const DASHBOARD_EDITOR_ATTR = "data-dashboard-editor" as const;

export type DashboardEditorSurface = "grid-chrome" | "drop-zone" | "tile-row" | "palette";

/** CSS / `querySelector` selector for one editor surface. */
export function dashboardEditorSurfaceSelector(surface: DashboardEditorSurface): string {
  return `[${DASHBOARD_EDITOR_ATTR}="${surface}"]`;
}

export const EDITOR_GRID_CHROME_SEL = dashboardEditorSurfaceSelector("grid-chrome");
export const EDITOR_DROP_ZONE_SEL = dashboardEditorSurfaceSelector("drop-zone");
export const EDITOR_TILE_ROW_SEL = dashboardEditorSurfaceSelector("tile-row");
export const EDITOR_PALETTE_SHELL_SEL = dashboardEditorSurfaceSelector("palette");

export function isDashboardEditorTileRow(el: Element): boolean {
  return el.getAttribute(DASHBOARD_EDITOR_ATTR) === "tile-row";
}
