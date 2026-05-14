<script lang="ts">
  let { title, payload }: { title: string; payload: unknown } = $props();
</script>

<section
  class="rounded-lg border border-slate-200 bg-white p-3 pt-9 shadow-sm dark:border-gray-700 dark:bg-gray-900"
>
  <h2 class="mb-2 text-sm font-semibold">{title}</h2>
  <pre class="max-h-64 overflow-auto text-xs">{JSON.stringify(payload, null, 2)}</pre>
</section>
