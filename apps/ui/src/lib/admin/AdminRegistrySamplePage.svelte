<script lang="ts">
  import type { DataGateway } from "../dataGateway";

  let { gateway: _gateway }: { gateway: DataGateway } = $props();
</script>

<div data-testid="admin-registry-sample-page">
  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Registry sample</h2>
  <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
    This page is registered via <span class="font-mono">adminRouteRegistry</span> (Phase 10) without growing ad-hoc
    conditionals in <span class="font-mono">AdminPage.svelte</span>.
  </p>
</div>
