<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import type { Snippet } from "svelte";

  /** Card chrome + title + loading/error for gauge-class tiles (UI_ENGINE_PLAN P5.4). */
  let {
    title,
    err,
    loading,
    /** Default slot; aliased so `{#snippet children()}` for `Card` does not shadow this binding. */
    children: tileBody,
    bodyClass = "flex min-h-0 flex-1 flex-col items-stretch justify-center sm:items-center",
  }: {
    title: string;
    err: string | null;
    loading: boolean;
    children: Snippet<[]>;
    bodyClass?: string;
  } = $props();
</script>

<Card
  size="xl"
  class="box-border h-full !max-w-full w-full min-w-0 flex-1 min-h-0 flex-col overflow-x-hidden overflow-y-auto"
>
  {#snippet children()}
    <div class="flex h-full min-h-0 w-full min-w-0 flex-col px-1.5 py-1 sm:px-2 sm:py-1.5">
      <h3 class="mb-0.5 shrink-0 text-center text-xs font-semibold leading-tight text-gray-900 dark:text-white">
        {title}
      </h3>
      {#if err}
        <p
          class="flex flex-1 items-center justify-center text-center text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          {err}
        </p>
      {:else if loading}
        <p class="flex flex-1 items-center justify-center text-center text-xs text-gray-500 dark:text-gray-400">
          Loading…
        </p>
      {:else}
        <div class={bodyClass}>
          {#if tileBody}{@render tileBody()}{/if}
        </div>
      {/if}
    </div>
  {/snippet}
</Card>
