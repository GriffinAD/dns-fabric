<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import Modal from "flowbite-svelte/Modal.svelte";
  import { get } from "svelte/store";
  import ArrowLeft from "lucide-svelte/icons/arrow-left";
  import Pencil from "lucide-svelte/icons/pencil";
  import Redo2 from "lucide-svelte/icons/redo-2";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import Save from "lucide-svelte/icons/save";
  import Server from "lucide-svelte/icons/server";
  import Undo2 from "lucide-svelte/icons/undo-2";

  import ThemeControls from "../../theme/ThemeControls.svelte";
  import DashboardControls from "../../dashboard/DashboardControls.svelte";
  import type { LayoutStore } from "../../dashboard/layoutStore";

  let {
    nodeLabel,
    uiVersion,
    editorOpen,
    ls,
    refreshing = false,
    peerUiBaseUrl = null,
    onOpenEditor,
    onCloseEditor,
    onResetBaseline,
    onSaveLayout,
    onRefresh,
  }: {
    nodeLabel: string;
    uiVersion: string;
    editorOpen: boolean;
    ls: LayoutStore;
    refreshing?: boolean;
    peerUiBaseUrl?: string | null;
    onOpenEditor: () => void;
    onCloseEditor: () => void | Promise<void>;
    onResetBaseline: () => void | Promise<void>;
    onSaveLayout: () => void | Promise<void>;
    onRefresh: () => void;
  } = $props();

  let resetConfirmOpen = $state(false);

  const headerLabelBandSpacerClass =
    "mb-1 hidden h-[1.125rem] w-0 max-w-0 shrink-0 overflow-hidden sm:block";

  const canUndo = $derived.by(() => {
    get(ls.layout);
    return ls.canUndo();
  });

  const canRedo = $derived.by(() => {
    get(ls.layout);
    return ls.canRedo();
  });

  function confirmResetBaseline() {
    void onResetBaseline();
    resetConfirmOpen = false;
  }

  $effect(() => {
    if (!editorOpen) resetConfirmOpen = false;
  });
</script>

<header
  class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
  data-testid="pihole-cp-shell-header"
>
  <div class="min-w-0">
    <h1 class="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-white">
      <Server class="h-8 w-8 shrink-0" aria-hidden="true" />
      Pi-hole HA control plane
    </h1>
    <p class="text-slate-600 dark:text-gray-400">
      Node <span class="font-mono text-sm">{nodeLabel}</span>
      · Operator shell (<span class="font-mono text-sm" data-testid="pihole-cp-ui-version">{uiVersion}</span>)
    </p>
  </div>
  <div
    class="flex w-full min-w-0 flex-col items-stretch gap-3 sm:max-w-none sm:flex-1 sm:items-end"
    data-testid="pihole-cp-header-actions"
  >
    <div class="flex w-full flex-wrap items-end justify-end gap-3">
      <div class="flex items-center gap-1" data-testid="pihole-cp-theme-controls">
        <ThemeControls showAccent={editorOpen} showGaugeSegmentToggle={editorOpen} />
      </div>
      {#if editorOpen}
        <DashboardControls />
      {/if}
      {#if peerUiBaseUrl}
        <div class="flex flex-col items-end">
          <span class={headerLabelBandSpacerClass} aria-hidden="true"></span>
          <a
            class="inline-flex shrink-0 items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-center text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            href={peerUiBaseUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="pihole-cp-peer-link"
          >
            Peer UI
          </a>
        </div>
      {/if}
      <div class="flex flex-col items-end">
        <span class={headerLabelBandSpacerClass} aria-hidden="true"></span>
        <Button
          type="button"
          color="alternative"
          size="sm"
          class="inline-flex shrink-0 items-center gap-2"
          disabled={refreshing}
          data-testid="pihole-cp-refresh"
          onclick={onRefresh}
        >
          <RefreshCw class="h-4 w-4 shrink-0 {refreshing ? 'animate-spin' : ''}" aria-hidden="true" />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      <div class="flex flex-col items-end">
        <span class={headerLabelBandSpacerClass} aria-hidden="true"></span>
        <div
          role="toolbar"
          aria-label="Dashboard mode"
          class="flex flex-wrap items-end {editorOpen ? 'gap-3' : 'gap-1'}"
        >
          {#if editorOpen}
            <Button
              type="button"
              color="alternative"
              size="sm"
              class="!p-2 shrink-0"
              aria-label="Undo layout change"
              data-testid="pihole-cp-layout-undo"
              disabled={!canUndo}
              onclick={() => ls.undo()}
            >
              <Undo2 class="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              color="alternative"
              size="sm"
              class="!p-2 shrink-0"
              aria-label="Redo layout change"
              data-testid="pihole-cp-layout-redo"
              disabled={!canRedo}
              onclick={() => ls.redo()}
            >
              <Redo2 class="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              color="danger"
              size="sm"
              class="outline shrink-0"
              aria-label="Reset dashboard layout to saved baseline"
              aria-haspopup="dialog"
              data-testid="pihole-cp-layout-reset"
              onclick={() => (resetConfirmOpen = true)}
            >
              Reset
            </Button>
            <Button
              type="button"
              color="alternative"
              size="sm"
              class="!p-2 shrink-0"
              aria-label="Save dashboard layout locally"
              data-testid="pihole-cp-layout-save"
              onclick={() => void onSaveLayout()}
            >
              <Save class="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              color="alternative"
              size="sm"
              class="!p-2"
              aria-label="Done editing layout"
              data-testid="pihole-cp-layout-edit-toggle"
              onclick={() => void onCloseEditor()}
            >
              <ArrowLeft class="h-5 w-5" aria-hidden="true" />
            </Button>
          {:else}
            <Button
              type="button"
              color="alternative"
              size="sm"
              class="!p-2"
              aria-label="Edit layout"
              data-testid="pihole-cp-layout-edit-toggle"
              onclick={onOpenEditor}
            >
              <Pencil class="h-5 w-5" aria-hidden="true" />
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</header>

<Modal bind:open={resetConfirmOpen} title="Reset dashboard layout?" size="md" class="z-[100]">
  {#snippet children()}
    <p class="text-base leading-relaxed text-gray-600 dark:text-gray-400">
      Restore the dashboard to the saved baseline? Unsaved layout editor changes will be lost.
    </p>
  {/snippet}
  {#snippet footer()}
    <div class="flex w-full flex-wrap justify-end gap-2">
      <Button type="button" color="alternative" onclick={() => (resetConfirmOpen = false)}>Cancel</Button>
      <Button type="button" color="danger" onclick={confirmResetBaseline}>Yes</Button>
    </div>
  {/snippet}
</Modal>
