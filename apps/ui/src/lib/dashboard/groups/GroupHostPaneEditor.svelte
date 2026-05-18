<script lang="ts">
  import type { Snippet } from "svelte";

  import EditorGroupNoWrapStrip from "../editor/EditorGroupNoWrapStrip.svelte";
  import type { HostPaneEditorBindings } from "./hostGroupPaneEditorTypes";
  import type { DashboardGroup, DashboardTile } from "../types";

  let {
    paneGroup,
    editLayout = false,
    paneEditor,
    tileContent,
  }: {
    paneGroup: DashboardGroup;
    editLayout?: boolean;
    paneEditor: HostPaneEditorBindings;
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  const gItems = $derived(paneEditor.getSubDndList(paneGroup));
  const isGroupEmpty = $derived(gItems.length === 0);
</script>

<div
  class="host-group-pane-editor pointer-events-auto relative z-10 flex h-full min-h-28 w-full min-w-0 flex-1 flex-col"
  data-testid="host-group-pane-editor"
  data-pane-group-id={paneGroup.id}
  data-editor-group-surface-drop="true"
>
  <EditorGroupNoWrapStrip
    group={paneGroup}
    {gItems}
    {isGroupEmpty}
    dropCb={paneEditor.dropCb}
    chromeDragSm={paneEditor.chromeDragSm}
    chromeEditSm={paneEditor.chromeEditSm}
    editorTileInPlay={paneEditor.editorTileInPlay}
    editorGroupInPlay={paneEditor.editorGroupInPlay}
    onEditGroup={paneEditor.onEditGroup}
    {editLayout}
    onEditTile={paneEditor.onEditTile}
    onItemColSpanChange={paneEditor.onItemColSpanChange}
    getSubDndList={paneEditor.getSubDndList}
    noWrapEditPortW={paneEditor.noWrapEditPortW}
    noWrapStripPortMeasure={paneEditor.noWrapStripPortMeasure}
    groupInnerSurfaceDragActive={paneEditor.groupInnerSurfaceDragActive}
    {tileContent}
  />
</div>
