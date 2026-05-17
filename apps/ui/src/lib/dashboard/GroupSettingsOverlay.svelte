<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";

  import { clampGridColSpan, clampGridRowSpan, GRID_COLUMNS } from "./gridPlacement";
  import type { DashboardGroup, GroupChild, GroupHostControl } from "./types";
  import { isDashboardGroupNode, MAX_TAB_GROUP_CHILDREN } from "./types";

  const CONTAINER_TYPE_OPTIONS: {
    value: GroupHostControl;
    label: string;
    disabled?: boolean;
    title?: string;
  }[] = [
    { value: "panel", label: "panel" },
    { value: "tab-control", label: "tab-control" },
    {
      value: "vertical-stack",
      label: "vertical-stack",
      disabled: true,
      title: "not implemented",
    },
    {
      value: "split-grid",
      label: "split-grid",
      disabled: true,
      title: "not implemented",
    },
  ];

  function effectiveHostControl(g: DashboardGroup): GroupHostControl {
    return g.hostControl ?? "panel";
  }

  function tabLabelForChild(child: GroupChild): string {
    return isDashboardGroupNode(child)
      ? (child.tabLabel ?? child.id)
      : (child.tabLabel ?? child.pluginId);
  }

  function labelTabChildren(children: GroupChild[]): GroupChild[] {
    return children.map((child) => {
      const tabLabel = tabLabelForChild(child);
      if (isDashboardGroupNode(child)) {
        return { ...child, tabLabel };
      }
      if (child.hostControl === "tab-control") {
        const { hostControl: _hc, ...rest } = child;
        return { ...rest, hostControl: "single-panel", tabLabel };
      }
      return { ...child, tabLabel };
    });
  }

  function convertToTabControl(group: DashboardGroup): DashboardGroup {
    const children = labelTabChildren(group.children);
    const active =
      group.hostState?.activeChildId != null &&
      children.some((c) => c.id === group.hostState?.activeChildId)
        ? group.hostState.activeChildId
        : children[0]?.id;
    return {
      ...group,
      hostControl: "tab-control",
      innerWrap: false,
      hostState: active != null ? { activeChildId: active } : undefined,
      children,
    };
  }

  function convertToPanel(group: DashboardGroup): DashboardGroup {
    const { hostControl: _hc, hostState: _hs, ...rest } = group;
    return rest;
  }

  function canUseTabControl(group: DashboardGroup): boolean {
    const n = group.children.length;
    return n >= 1 && n <= MAX_TAB_GROUP_CHILDREN;
  }

  let {
    group,
    onClose,
    onSave,
    onDelete,
  }: {
    group: DashboardGroup;
    onClose: () => void;
    onSave: (next: DashboardGroup) => void;
    /** Remove this container (and nested content) from the layout. */
    onDelete?: () => void;
  } = $props();

  function cloneDraft(g: DashboardGroup): DashboardGroup {
    const gr = g.grid;
    const grid = gr
      ? {
          col: gr.col,
          row: gr.row,
          colSpan: clampGridColSpan(gr.colSpan),
          rowSpan: clampGridRowSpan(gr.rowSpan),
        }
      : { col: 0, row: 0, colSpan: GRID_COLUMNS, rowSpan: 1 };
    return {
      ...g,
      showBorder: g.showBorder !== false,
      innerWrap: g.innerWrap === true,
      grid,
    };
  }

  // svelte-ignore state_referenced_locally
  let draft = $state(cloneDraft(group));

  $effect(() => {
    draft = cloneDraft(group);
  });

  function save() {
    if (!draft?.grid) return;
    const g = draft.grid;
    const host = effectiveHostControl(draft);
    let next: DashboardGroup = {
      ...draft,
      showBorder: draft.showBorder !== false,
      innerWrap: draft.innerWrap === true,
      grid: {
        col: g.col,
        row: g.row,
        colSpan: clampGridColSpan(g.colSpan),
        rowSpan: clampGridRowSpan(g.rowSpan),
      },
    };
    if (host === "tab-control") {
      next = convertToTabControl(next);
    } else {
      next = convertToPanel(next);
    }
    onSave(next);
  }

  function onContainerTypeChange(value: GroupHostControl) {
    if (!draft) return;
    if (value === "tab-control") {
      if (!canUseTabControl(draft)) return;
      draft = convertToTabControl(draft);
      return;
    }
    if (value === "panel") {
      draft = convertToPanel(draft);
    }
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if draft?.grid}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="presentation"
    data-testid="group-settings-overlay"
    onclick={onBackdropClick}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-settings-title"
      tabindex="-1"
      class="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl outline-none dark:border-gray-700 dark:bg-gray-800"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-6">
        <h2 id="group-settings-title" class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Container settings
        </h2>
        <p class="mb-2 text-sm text-gray-600 dark:text-gray-400">Container id</p>
        <p class="mb-4 font-mono text-sm text-gray-900 dark:text-white">{draft.id}</p>

        <div class="space-y-4">
          <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            <span>Container type</span>
            <select
              class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              data-testid="group-settings-container-type"
              value={effectiveHostControl(draft)}
              onchange={(e) => {
                onContainerTypeChange(
                  (e.currentTarget as HTMLSelectElement).value as GroupHostControl,
                );
              }}
            >
              {#each CONTAINER_TYPE_OPTIONS as opt (opt.value)}
                <option
                  value={opt.value}
                  disabled={opt.disabled ||
                    (opt.value === "tab-control" && !canUseTabControl(draft))}
                  title={opt.title ??
                    (opt.value === "tab-control" && !canUseTabControl(draft)
                      ? `tab-control requires 1–${MAX_TAB_GROUP_CHILDREN} children`
                      : undefined)}
                >
                  {opt.label}
                </option>
              {/each}
            </select>
          </label>
          {#if effectiveHostControl(draft) === "tab-control"}
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Each child is a tab; labels default from plugin or container id when you switch
              types.
            </p>
          {/if}

          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={draft.showBorder !== false}
              onchange={() => {
                draft = { ...draft!, showBorder: !draft!.showBorder };
              }}
            />
            Show border around container
          </label>
          {#if effectiveHostControl(draft) !== "tab-control"}
            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={draft.innerWrap === true}
                data-testid="group-settings-inner-wrap"
                onchange={() => {
                  draft = { ...draft!, innerWrap: !draft!.innerWrap };
                }}
              />
              Auto wrap tiles to a new row when a row is full
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              When off, tiles use the same G-wide column grid without reflowing; turn on to pack into
              additional rows when a row would not fit.
            </p>
          {/if}

          <p class="text-xs text-gray-500 dark:text-gray-400">
            Placement on the main dashboard grid ({GRID_COLUMNS} columns). Adjust column/row origin and span.
          </p>

          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span>Width (columns)</span>
              <input
                type="number"
                min="1"
                max={GRID_COLUMNS}
                class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={draft.grid.colSpan}
                data-testid="group-settings-col-span"
                oninput={(e) => {
                  const n = Number((e.currentTarget as HTMLInputElement).value);
                  const cs = clampGridColSpan(n);
                  const col = Math.min(draft!.grid!.col, GRID_COLUMNS - cs);
                  draft = {
                    ...draft!,
                    grid: { ...draft!.grid!, colSpan: cs, col },
                  };
                }}
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span>Height (rows)</span>
              <input
                type="number"
                min="1"
                max="12"
                class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={draft.grid.rowSpan}
                data-testid="group-settings-row-span"
                oninput={(e) => {
                  const n = Number((e.currentTarget as HTMLInputElement).value);
                  draft = {
                    ...draft!,
                    grid: { ...draft!.grid!, rowSpan: clampGridRowSpan(n) },
                  };
                }}
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span>Column (0–{GRID_COLUMNS - 1})</span>
              <input
                type="number"
                min="0"
                max={GRID_COLUMNS - 1}
                class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={draft.grid.col}
                data-testid="group-settings-col"
                oninput={(e) => {
                  const n = Number((e.currentTarget as HTMLInputElement).value);
                  const cs = draft!.grid!.colSpan;
                  const col = Math.max(0, Math.min(GRID_COLUMNS - cs, Math.floor(n)));
                  draft = {
                    ...draft!,
                    grid: { ...draft!.grid!, col },
                  };
                }}
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span>Row (from top)</span>
              <input
                type="number"
                min="0"
                class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={draft.grid.row}
                data-testid="group-settings-row"
                oninput={(e) => {
                  const n = Number((e.currentTarget as HTMLInputElement).value);
                  const row = Math.max(0, Math.floor(n));
                  draft = {
                    ...draft!,
                    grid: { ...draft!.grid!, row },
                  };
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div
        class="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-600 dark:bg-gray-900 {onDelete
          ? 'justify-between'
          : 'justify-end'}"
      >
        {#if onDelete}
          <button
            type="button"
            data-testid="group-settings-delete"
            class="rounded-lg border border-red-200 px-4 py-2.5 text-center text-sm font-medium text-red-600 hover:bg-red-50 focus:ring-4 focus:ring-red-200 focus:outline-none dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 dark:focus:ring-red-900"
            onclick={onDelete}
          >
            Remove container
          </button>
        {/if}
        <div class="flex shrink-0 gap-2">
          <Button type="button" color="alternative" onclick={onClose}>Cancel</Button>
          <button
            type="button"
            class="rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 focus:outline-none dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            data-testid="group-settings-save"
            onclick={save}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
