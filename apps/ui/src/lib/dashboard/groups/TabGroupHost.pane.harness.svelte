<script lang="ts">
  import type { DashboardGroup } from "../types";
  import TabGroupHost from "./TabGroupHost.svelte";
  import type { HostPaneEditorBindings } from "./hostGroupPaneEditorTypes";

  let {
    group,
    paneEditor,
  }: {
    group: DashboardGroup;
    paneEditor: HostPaneEditorBindings;
  } = $props();

  const noopDropCb = {
    onDrop: () => {},
    onDragOver: () => {},
    onDragEnd: () => {},
  };
</script>

<TabGroupHost
  group={group}
  editLayout={true}
  layoutDropCb={noopDropCb}
  {paneEditor}
>
  {#snippet tileContent(tile)}
    <div data-tile-body={tile.id}>{tile.pluginId}</div>
  {/snippet}
</TabGroupHost>
