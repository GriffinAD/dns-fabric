<script lang="ts">
  import GaugeTileLayout from "./GaugeTileLayout.svelte";

  let {
    title,
    err,
    loading,
    bodyClass,
  }: {
    title: string;
    err: string | null;
    loading: boolean;
    bodyClass?: string;
  } = $props();
</script>

<GaugeTileLayout {title} {err} {loading} bodyClass={bodyClass}>
  {#snippet children()}
    <div data-testid="gauge-tile-body">tile body</div>
  {/snippet}
</GaugeTileLayout>
