<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import ArrowLeft from "lucide-svelte/icons/arrow-left";
  import House from "lucide-svelte/icons/house";
  import Pencil from "lucide-svelte/icons/pencil";
  import Settings from "lucide-svelte/icons/settings";

  import ThemeControls from "../theme/ThemeControls.svelte";
  import { UI_VERSION } from "../uiVersion";
  import DashboardControls from "./DashboardControls.svelte";
  import type { LayoutSource } from "./layoutStore";

  let {
    route,
    layoutSource,
    editorOpen,
    onSelectDashboardView,
    onOpenEditor,
    onResetBaseline,
    onGoHome,
    onGoAdmin,
  }: {
    route: "home" | "admin";
    layoutSource: LayoutSource;
    editorOpen: boolean;
    onSelectDashboardView: () => void;
    onOpenEditor: () => void;
    onResetBaseline: () => void;
    onGoHome: () => void;
    onGoAdmin: () => void;
  } = $props();
</script>

<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
  <div class="min-w-0">
    <h1 class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
      <House class="h-8 w-8 shrink-0" aria-hidden="true" />
      Kea Fabric
    </h1>
    <p class="text-gray-600 dark:text-gray-400">
      Operator shell ({UI_VERSION}). Flowbite Svelte v2 + mocked <code class="font-mono text-sm">/api/v1</code>.
    </p>
    {#if layoutSource === "cache"}
      <p
        class="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400"
        data-testid="layout-source-cache-badge"
      >
        Layout loaded from cache (server layout unavailable).
      </p>
    {/if}
  </div>
  <div
    class="flex w-full min-w-0 flex-col items-stretch gap-3 sm:max-w-none sm:flex-1 sm:items-end"
    data-testid="app-header-actions"
  >
    <div class="flex w-full flex-wrap items-end justify-end gap-3">
      <ThemeControls showAccent={route === "home" && editorOpen} />
      {#if route === "home" && editorOpen}
        <DashboardControls />
      {/if}
      {#if route === "home"}
        <div role="toolbar" aria-label="Dashboard mode" class="flex flex-wrap items-center gap-1">
          {#if editorOpen}
            <Button
              type="button"
              color="alternative"
              class="!p-2"
              aria-label="Return to dashboard"
              onclick={() => onSelectDashboardView()}
            >
              <ArrowLeft class="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              color="danger"
              class="outline shrink-0"
              aria-label="Reset dashboard layout to saved baseline"
              onclick={() => onResetBaseline()}
            >
              Reset
            </Button>
          {:else}
            <Button type="button" color="alternative" class="!p-2" aria-label="Edit layout" onclick={() => onOpenEditor()}>
              <Pencil class="h-5 w-5" aria-hidden="true" />
            </Button>
          {/if}
        </div>
      {/if}
      {#if route === "admin"}
        <Button type="button" color="alternative" class="inline-flex shrink-0 items-center gap-2" onclick={onGoHome}>
          <House class="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Button>
      {:else if !editorOpen}
        <Button type="button" class="inline-flex shrink-0 items-center gap-2" onclick={() => void onGoAdmin()}>
          <Settings class="h-4 w-4" aria-hidden="true" />
          Admin
        </Button>
      {/if}
    </div>
  </div>
</header>
