<script lang="ts">
  import type { DashboardTile } from "../../dashboard/types";
  import PerfOptionsForm from "./PerfOptionsForm.svelte";

  let { initial }: { initial: DashboardTile } = $props();

  // svelte-ignore state_referenced_locally
  let draft = $state<DashboardTile>(structuredClone(initial));
</script>

<PerfOptionsForm bind:draft />

<!-- Expose latest draft for tests via a data attribute (read-only mirror). -->
<div data-testid="draft-json" hidden>{JSON.stringify(draft)}</div>
