/**
 * Editor selection state helpers extracted from `DashboardHost`.
 */
export function editorTileInPlay(
  editLayout: boolean,
  activeEditorKind: "tile" | "group" | null,
  activeEditorId: string | null,
  id: string,
): boolean {
  return editLayout && activeEditorKind === "tile" && activeEditorId === id;
}

export function editorGroupInPlay(
  editLayout: boolean,
  activeEditorKind: "tile" | "group" | null,
  activeEditorId: string | null,
  id: string,
): boolean {
  return editLayout && activeEditorKind === "group" && activeEditorId === id;
}
