/**
 * Edit-mode **plugin** chrome: hover/focus on a tile reveals drag + edit (delete lives in settings).
 *
 * Tile shell: {@link EDITOR_PLUGIN_HOVER_SHELL} (group + hover ring class). Controls: {@link EDITOR_PLUGIN_HOVER_VISIBLE}.
 * Caption strip above the plugin body: {@link EDITOR_PLUGIN_CAPTION_BAR_CLASS}.
 *
 * **Container** (root or nested group) grip/edit uses `data-editor-container-chrome` and rules in
 * `app.css` (`.editor-root-container-shell` / `.editor-nested-container-shell`) so hovering an inner
 * `.editor-plugin-surface` does not light up the parent container chrome. Container grip/edit nodes
 * are children of the shell so `position: absolute; top` aligns with the selection outline.
 *
 * Lateral nudge: `.editor-chrome-drag` / `.editor-chrome-edit` (`translateX`) use
 * `--editor-chrome-button-offset` / `--editor-chrome-top` (defaults in `app.css`; `DashboardHost` sets on
 * `editor-grid-chrome` from {@link EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX} /
 * {@link EDITOR_CHROME_TOP_OFFSET_PX}). Drag translates −offset, edit +offset. Vertical offset is from the **plugin-surface** anchor in
 * the DOM for **plugin** tiles (tile body below captions). Active selection outline: `.editor-surface-in-play`;
 * hover: solid emerald line + glow (40% mix) on `.editor-plugin-hover-highlight` + container shells in `app.css` (fine pointer only).
 */

/** Pixels edit moves right and drag moves left (`translateX(±…)`). */
export const EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX = 5;

/**
 * Pixels from the top of the **plugin surface** anchor (see module comment) to the top of the
 * drag/edit chrome.
 */
export const EDITOR_CHROME_TOP_OFFSET_PX = 0;

export const EDITOR_PLUGIN_HOVER_PARENT = "group/editor-plugin";

/**
 * Tile wrapper class for `app.css` hover outline (with {@link EDITOR_PLUGIN_HOVER_PARENT} on the same
 * element).
 */
export const EDITOR_PLUGIN_HOVER_HIGHLIGHT_CLASS = "editor-plugin-hover-highlight";

/** Tailwind group + hover-outline target for each editor tile shell. */
export const EDITOR_PLUGIN_HOVER_SHELL = [EDITOR_PLUGIN_HOVER_PARENT, EDITOR_PLUGIN_HOVER_HIGHLIGHT_CLASS].join(" ");

/** Apply to drag / edit on a **plugin tile** inside {@link EDITOR_PLUGIN_HOVER_PARENT}. */
export const EDITOR_PLUGIN_HOVER_VISIBLE = [
  "pointer-events-none opacity-0 transition-opacity duration-150 ease-out",
  "group-hover/editor-plugin:pointer-events-auto group-hover/editor-plugin:opacity-100",
  "group-focus-within/editor-plugin:pointer-events-auto group-focus-within/editor-plugin:opacity-100",
  "[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
].join(" ");

/** Drag grip on tiles inside a container — always visible in edit mode (no hover-only). */
export const EDITOR_TILE_IN_GROUP_DRAG_VISIBLE =
  "pointer-events-auto opacity-100 transition-opacity duration-150 ease-out";

/**
 * Caption strip above the plugin body in edit mode (placement hint or container label).
 * Always visible (not {@link EDITOR_PLUGIN_HOVER_VISIBLE} — that hid the strip at opacity 0 until hover).
 * Light mode: clearly tinted bar so it does not read as white against the white tile shell.
 */
export const EDITOR_PLUGIN_CAPTION_BAR_CLASS = [
  "min-h-0 truncate border-b py-0.5 text-[10px]",
  "border-slate-200/90 bg-slate-100 text-slate-600",
  "dark:border-gray-600/60 dark:bg-gray-800 dark:text-gray-400",
].join(" ");

/** Marks the plugin body for `:has()` rules on container shells (see `app.css`). */
export const EDITOR_PLUGIN_SURFACE_CLASS = "editor-plugin-surface";

/**
 * Root grid shell marker — `app.css` applies resting shadow to container panels (fill grid area)
 * or to the bordered control body for standalone tiles (`align-self: start`, not row stretch).
 */
export const EDITOR_LAYOUT_ELEVATED_CLASS = "editor-layout-elevated";

/**
 * Visible label for a dashboard container (root or nested). The wire model uses `id` as the
 * stable name; show it so nested hierarchy matches **Tile settings → Parent** and read-mode
 * captions on plugin tiles.
 */
export function nestedContainerDisplayTitle(groupId: string): string {
  return `Container: ${groupId}`;
}

/** sveltednd drag handle selector for root and nested container chrome. */
export const CONTAINER_DND_HANDLE =
  '[data-testid="editor-container-drag-handle"],[data-testid="editor-nested-group-drag-handle"]';

/** sveltednd drag handle selector for tiles inside a group. */
export const EDITOR_TILE_DND_HANDLE = '[data-testid="editor-tile-drag-handle"]';

export const editorDndDragAttrs = {
  draggingClass: "opacity-90 shadow-md rounded-md ring-2 ring-primary-500/35",
};

export const editorDndDropAttrs = {
  dragOverClass:
    "svelte-dnd-drop-target outline outline-2 outline-dashed outline-offset-[3px] rounded-md outline-primary-500",
};
