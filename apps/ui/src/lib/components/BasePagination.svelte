<script lang="ts">
  import { buildPaginationTokens, clampPage, slotsForDensity, type BasePaginationDensity } from "./basePagination";

  let {
    page,
    totalPages,
    density = "default",
    onChange,
    ariaLabel = "Pagination",
  }: {
    page: number;
    totalPages: number;
    density?: BasePaginationDensity;
    onChange: (nextPage: number) => void;
    ariaLabel?: string;
  } = $props();

  const slots = $derived(slotsForDensity(density));
  const canPrevious = $derived(page > 1);
  const canNext = $derived(page < totalPages);
  const tokens = $derived(buildPaginationTokens(totalPages, page, slots));
  const centerWidthClass = $derived(
    density === "compact" ? "w-[12rem]" : density === "expanded" ? "w-[20rem]" : "w-[16rem]",
  );

  function goTo(nextPage: number) {
    const clamped = clampPage(nextPage, totalPages);
    if (clamped === page) return;
    onChange(clamped);
  }

  function onKeyNav(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (canPrevious) goTo(page - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (canNext) goTo(page + 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      goTo(1);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      goTo(totalPages);
    }
  }
</script>

{#if totalPages > 1}
  <div
    class="flex flex-wrap items-center gap-2.5"
    role="navigation"
    aria-label={ariaLabel}
  >
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-sm text-gray-700 shadow-sm transition-[background-color,border-color,color,box-shadow] hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-800 dark:disabled:border-gray-700 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
      aria-label="Previous page"
      aria-disabled={canPrevious ? "false" : "true"}
      disabled={!canPrevious}
      onkeydown={onKeyNav}
      onclick={() => goTo(page - 1)}
    >
      <span aria-hidden="true">◀</span>
    </button>

    <div class={`flex h-9 items-center justify-center px-1 ${centerWidthClass}`}>
      <div class="flex items-center justify-center gap-0.5">
        {#each tokens as token (token.kind === "page" ? `p-${token.page}` : `g-${token.id}`)}
          {#if token.kind === "page"}
            <button
              type="button"
              class={token.page === page
                ? "inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-300 px-2 text-xs font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
                : "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-xs font-medium text-gray-700 transition-colors hover:bg-white hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"}
              aria-label={`Go to page ${token.page}`}
              aria-current={token.page === page ? "page" : undefined}
              onkeydown={onKeyNav}
              onclick={() => goTo(token.page)}
            >
              {token.page}
            </button>
          {:else}
            <span
              class="inline-flex h-7 min-w-7 items-center justify-center text-xs text-gray-500/60 dark:text-gray-400/55"
              aria-hidden="true"
            >
              …
            </span>
          {/if}
        {/each}
      </div>
    </div>

    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-sm text-gray-700 shadow-sm transition-[background-color,border-color,color,box-shadow] hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-800 dark:disabled:border-gray-700 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
      aria-label="Next page"
      aria-disabled={canNext ? "false" : "true"}
      disabled={!canNext}
      onkeydown={onKeyNav}
      onclick={() => goTo(page + 1)}
    >
      <span aria-hidden="true">▶</span>
    </button>

  </div>
{/if}
