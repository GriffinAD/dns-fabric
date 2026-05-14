<script lang="ts">
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import { untrack } from "svelte";
  import { dragHandle, dragHandleZone, SOURCES } from "svelte-dnd-action";
  import type { DndEvent } from "svelte-dnd-action";

  import type { DashboardResponse } from "./dashboardZod";
  import SectionDashboardTile from "./SectionDashboardTile.svelte";

  const LS_ORDER_KEY = "pihole-cp.widget-order.v1";

  let { dashboard, layoutEditMode = false }: { dashboard: DashboardResponse; layoutEditMode?: boolean } =
    $props();

  type Row = { id: string; widgetId: string };
  let items = $state<Row[]>([]);

  type DndConsiderFinalize = CustomEvent<DndEvent<Row>>;

  let pointerDragActive = $state(false);

  function baseRows(): Row[] {
    return dashboard.widgets.map((w) => ({ id: w.id, widgetId: w.id }));
  }

  function applySavedOrder(base: Row[]): Row[] {
    if (typeof localStorage === "undefined") return base;
    try {
      const raw = localStorage.getItem(LS_ORDER_KEY);
      if (!raw) return base;
      const order = JSON.parse(raw) as unknown;
      if (!Array.isArray(order) || !order.every((x): x is string => typeof x === "string")) {
        return base;
      }
      const byId = new Map(base.map((r) => [r.widgetId, r]));
      const next: Row[] = [];
      for (const wid of order) {
        const hit = byId.get(wid);
        if (hit) {
          next.push(hit);
          byId.delete(wid);
        }
      }
      for (const r of base) {
        if (byId.has(r.widgetId)) next.push(r);
      }
      return next;
    } catch {
      return base;
    }
  }

  $effect(() => {
    const merged = applySavedOrder(baseRows());
    untrack(() => {
      items = merged;
    });
  });

  function handleConsider(e: DndConsiderFinalize) {
    if (e.detail.info.source === SOURCES.POINTER) {
      pointerDragActive = true;
    }
    items = e.detail.items;
  }

  function handleFinalize(e: DndConsiderFinalize) {
    pointerDragActive = false;
    items = e.detail.items;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_ORDER_KEY, JSON.stringify(items.map((i) => i.widgetId)));
    }
  }
</script>

<div
  class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3"
  data-editor-pointer-dnd={pointerDragActive ? "true" : "false"}
  data-pihole-cp-layout-edit={layoutEditMode ? "true" : "false"}
  use:dragHandleZone={{
    items,
    flipDurationMs: 150,
    type: "pihole-cp-widgets",
    autoAriaDisabled: true,
    morphDisabled: true,
    centreDraggedOnCursor: false,
  }}
  onconsider={handleConsider}
  onfinalize={handleFinalize}
>
  {#each items as it (it.id)}
    {@const w = dashboard.widgets.find((x) => x.id === it.widgetId)}
    {#if w}
      <div class="relative min-w-0">
        {#if layoutEditMode}
          <button
            type="button"
            class="absolute top-2 left-2 z-10 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md border border-slate-200/80 bg-slate-50/95 text-slate-600 shadow-sm active:cursor-grabbing dark:border-gray-600 dark:bg-gray-900/85 dark:text-gray-300"
            aria-label="Drag to reorder widget"
            data-testid="pihole-cp-widget-drag-handle"
            use:dragHandle
          >
            <GripVertical class="h-4 w-4" aria-hidden="true" />
          </button>
        {/if}
        <SectionDashboardTile section={w.section} title={w.title} payload={dashboard.sections[w.section]} />
      </div>
    {/if}
  {/each}
</div>
