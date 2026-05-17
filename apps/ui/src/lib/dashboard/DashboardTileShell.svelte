<script lang="ts">
  import type { Snippet } from "svelte";
  import TileEditChrome from "./tiles/TileEditChrome.svelte";
  import { EDITOR_LAYOUT_ELEVATED_CLASS } from "./interactions/editorChrome";
  import type { DashboardTile } from "./types";

  let {
    tile,
    editLayout = false,
    elevated = false,
    onEditTile,
    children,
  }: {
    tile: DashboardTile;
    editLayout?: boolean;
    elevated?: boolean;
    onEditTile?: (t: DashboardTile) => void;
    children: Snippet;
  } = $props();
</script>

<div
  class="flex w-full min-w-0 max-w-full flex-col self-start {elevated ? EDITOR_LAYOUT_ELEVATED_CLASS : ''}"
  data-tile-id={tile.id}
>
  <TileEditChrome {tile} onEdit={onEditTile} showEditButton={editLayout}>
    {#snippet children()}
      {@render children()}
    {/snippet}
  </TileEditChrome>
</div>
