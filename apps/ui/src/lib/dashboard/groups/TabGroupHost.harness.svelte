<script lang="ts">
  import type { DashboardGroup } from "../types";
  import TabGroupHost from "./TabGroupHost.svelte";

  let {
    group,
    editLayout = false,
    onGroupChange,
  }: {
    group: DashboardGroup;
    editLayout?: boolean;
    onGroupChange?: (g: DashboardGroup) => void;
  } = $props();
</script>

<TabGroupHost {group} {editLayout} {onGroupChange}>
  {#snippet tileContent(tile)}
    <div data-tile-body={tile.id}>{tile.pluginId}</div>
  {/snippet}
</TabGroupHost>
