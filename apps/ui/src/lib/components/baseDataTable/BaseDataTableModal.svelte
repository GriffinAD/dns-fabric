<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import Input from "flowbite-svelte/Input.svelte";
  import Modal from "flowbite-svelte/Modal.svelte";

  import type { BaseDataTableColumn } from "./baseDataTable";
  import { columnStableId, isColumnSortable } from "./baseDataTable";
  import { buildCsvExport, buildJsonExport, exportFilenameBase, triggerDownload } from "./tableExport";
  import { cycleSortDirection, filterRowsForTable, sortRowsWithState, type TableSortState } from "./tableRowModel";
  import { hasValidationErrors, validateDirtyRowFields } from "./tableValidation";

  const selectClass =
    "w-full min-w-[8rem] rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white";

  const inputClass =
    "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white";

  let {
    open = $bindable(false),
    title,
    items,
    columns,
    rowKey,
    allowEdit,
    onCommit,
    compact = false,
    jsonPrettyExport = true,
    defaultSortColumnId,
    defaultSortDirection = "asc",
  }: {
    open?: boolean;
    title: string;
    items: unknown[];
    columns: BaseDataTableColumn[];
    rowKey: (row: unknown) => string;
    allowEdit: boolean;
    onCommit?: (args: { rowId: string; patch: Record<string, unknown> }) => void | Promise<void>;
    compact?: boolean;
    jsonPrettyExport?: boolean;
    defaultSortColumnId?: string;
    defaultSortDirection?: "asc" | "desc";
  } = $props();

  let baseline = $state<Record<string, Record<string, unknown>>>({});
  let edits = $state<Record<string, Record<string, unknown>>>({});
  let fieldErrors = $state<Record<string, string>>({});
  let saveError = $state<string | null>(null);
  let saving = $state(false);
  let editMode = $state(false);
  let filterQuery = $state("");
  let sortState = $state<TableSortState>({ columnId: null, direction: null });
  let exportMenuOpen = $state(false);
  let exportDefault = $state<"json" | "csv">("json");
  let announce = $state("");
  let initializedForOpenSession = $state(false);

  function stableString(v: unknown): string {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  $effect.pre(() => {
    if (!open) {
      initializedForOpenSession = false;
      return;
    }
    if (initializedForOpenSession) return;
    edits = {};
    fieldErrors = {};
    saveError = null;
    saving = false;
    editMode = false;
    filterQuery = "";
    const hasDefaultSort =
      !!defaultSortColumnId &&
      columns.some((c) => columnStableId(c) === defaultSortColumnId && isColumnSortable(true, c));
    sortState = hasDefaultSort
      ? { columnId: defaultSortColumnId!, direction: defaultSortDirection }
      : { columnId: null, direction: null };
    exportMenuOpen = false;
    const b: Record<string, Record<string, unknown>> = {};
    for (const row of items) {
      const rid = rowKey(row);
      b[rid] = {};
      for (const col of columns) {
        if (col.editable && col.fieldKey) {
          b[rid][col.fieldKey] = col.getEditValue ? col.getEditValue(row) : col.accessor(row);
        }
      }
    }
    baseline = b;
    initializedForOpenSession = true;
  });

  function getCellValue(row: unknown, col: BaseDataTableColumn): unknown {
    const rid = rowKey(row);
    const fk = col.fieldKey;
    if (fk && edits[rid]?.[fk] !== undefined) return edits[rid][fk];
    return col.getEditValue ? col.getEditValue(row) : col.accessor(row);
  }

  function setCellValue(row: unknown, col: BaseDataTableColumn, value: unknown) {
    const rid = rowKey(row);
    const fk = col.fieldKey;
    if (!fk) return;
    const nextRow = { ...(edits[rid] ?? {}), [fk]: value };
    edits = { ...edits, [rid]: nextRow };
    const ek = `${rid}:${fk}`;
    if (fieldErrors[ek]) {
      const { [ek]: _, ...rest } = fieldErrors;
      fieldErrors = rest;
    }
  }

  function rowPatch(row: unknown): Record<string, unknown> | null {
    const rid = rowKey(row);
    const patch: Record<string, unknown> = {};
    for (const col of columns) {
      if (!col.editable || !col.fieldKey) continue;
      const cur = getCellValue(row, col);
      const base = baseline[rid]?.[col.fieldKey];
      if (stableString(cur) !== stableString(base)) {
        if (col.setPatchValue) {
          col.setPatchValue(patch, cur);
        } else {
          patch[col.fieldKey] = cur;
        }
      }
    }
    return Object.keys(patch).length > 0 ? patch : null;
  }

  function currentRowValues(row: unknown): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      if (col.editable && col.fieldKey) {
        out[col.fieldKey] = getCellValue(row, col);
      }
    }
    return out;
  }

  async function saveRow(row: unknown) {
    saveError = null;
    const patch = rowPatch(row);
    if (!patch || !onCommit) return;
    const rid = rowKey(row);
    const errs = validateDirtyRowFields(row, columns, currentRowValues(row));
    if (hasValidationErrors(errs)) {
      const next: Record<string, string> = { ...fieldErrors };
      for (const [fk, msg] of Object.entries(errs)) {
        next[`${rid}:${fk}`] = msg;
      }
      fieldErrors = next;
      return;
    }
    saving = true;
    try {
      await onCommit({ rowId: rid, patch });
      const nextEdits = { ...edits };
      delete nextEdits[rid];
      edits = nextEdits;
      baseline = {
        ...baseline,
        [rid]: { ...baseline[rid], ...patch },
      };
    } catch (e: unknown) {
      saveError = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  async function saveAllDirty() {
    saveError = null;
    let guard = 0;
    while (guard++ < items.length + 2) {
      const next = items.find((row) => rowPatch(row));
      if (!next) break;
      await saveRow(next);
      if (saveError) break;
    }
  }

  const hasAnyDirty = $derived(items.some((row) => rowPatch(row) !== null));
  const filtered = $derived(filterRowsForTable(items, columns, filterQuery, true));
  const sorted = $derived(sortRowsWithState(filtered, columns, sortState, true));

  function onHeaderSort(col: BaseDataTableColumn) {
    if (!isColumnSortable(true, col)) return;
    const id = columnStableId(col);
    if (sortState.columnId !== id) {
      sortState = { columnId: id, direction: "asc" };
      return;
    }
    const next = cycleSortDirection(sortState.direction);
    sortState = { columnId: next === null ? null : id, direction: next };
  }

  function headerAriaSort(col: BaseDataTableColumn): "none" | "ascending" | "descending" | undefined {
    if (!isColumnSortable(true, col)) return undefined;
    const id = columnStableId(col);
    if (sortState.columnId !== id || !sortState.direction) return "none";
    return sortState.direction === "asc" ? "ascending" : "descending";
  }

  function sortGlyph(col: BaseDataTableColumn): "▲" | "▼" | "" {
    const id = columnStableId(col);
    if (sortState.columnId !== id || !sortState.direction) return "";
    return sortState.direction === "asc" ? "▲" : "▼";
  }

  function doExportCsv() {
    const body = buildCsvExport(sorted, columns, { compact });
    triggerDownload(exportFilenameBase(title, "csv"), "text/csv;charset=utf-8", body);
    announce = `Exported ${exportFilenameBase(title, "csv")}`;
  }

  function doExportJson() {
    const body = buildJsonExport(sorted, columns, { compact, pretty: jsonPrettyExport });
    triggerDownload(exportFilenameBase(title, "json"), "application/json;charset=utf-8", body);
    announce = `Exported ${exportFilenameBase(title, "json")}`;
  }

  function runExport(kind: "json" | "csv") {
    exportDefault = kind;
    if (kind === "csv") {
      doExportCsv();
      return;
    }
    doExportJson();
  }

  function errId(rid: string, fk: string): string {
    return `modal-err-${rid}-${fk}`;
  }
</script>

<Modal bind:open {title} size="xl" class="z-[100]">
  {#snippet children()}
    <div class="sr-only" aria-live="polite">{announce}</div>
    <div class="mb-2 flex flex-wrap items-end gap-2">
      <div class="min-w-[12rem] flex-1">
        <label class="sr-only" for="modal-filter">Filter rows</label>
        <Input id="modal-filter" type="search" placeholder="Search…" bind:value={filterQuery} class="w-full" />
      </div>
      {#if filterQuery.trim().length > 0}
        <span class="mr-2 text-sm text-gray-600 dark:text-gray-300" data-testid="modal-row-count">
          {sorted.length} rows
        </span>
      {/if}
      <div class="relative inline-flex items-stretch">
        <Button
          type="button"
          size="sm"
          color="alternative"
          class="rounded-r-none"
          onclick={() => {
            runExport(exportDefault);
          }}
        >
          Export {exportDefault === "json" ? "JSON" : "CSV"}
        </Button>
        <Button
          type="button"
          size="sm"
          color="alternative"
          class="rounded-l-none border-l-0 px-2"
          onclick={() => {
            exportMenuOpen = !exportMenuOpen;
          }}
          aria-label="Open export options"
          aria-expanded={exportMenuOpen ? "true" : "false"}
          aria-haspopup="menu"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" class="h-4 w-4" fill="currentColor">
            <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.18l3.71-3.95a.75.75 0 1 1 1.08 1.04l-4.25 4.53a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" />
          </svg>
        </Button>
        {#if exportMenuOpen}
          <div
            role="menu"
            class="absolute right-0 top-full z-20 mt-1 min-w-[9rem] rounded border border-gray-200 bg-white p-1 shadow dark:border-gray-700 dark:bg-gray-800"
          >
            <button
              type="button"
              role="menuitem"
              class="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
              onclick={() => {
                runExport("json");
                exportMenuOpen = false;
              }}
            >
              Export JSON
            </button>
            <button
              type="button"
              role="menuitem"
              class="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
              onclick={() => {
                runExport("csv");
                exportMenuOpen = false;
              }}
            >
              Export CSV
            </button>
          </div>
        {/if}
      </div>
      {#if allowEdit}
        <Button
          type="button"
          size="sm"
          color={editMode ? "brand" : "alternative"}
          aria-label="Toggle edit mode"
          onclick={() => (editMode = !editMode)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9" />
            <path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" />
          </svg>
          <span>{editMode ? "Done editing" : "Edit"}</span>
        </Button>
      {/if}
    </div>
    {#if saveError}
      <p class="mb-2 text-sm text-red-600 dark:text-red-400" role="alert" data-testid="modal-save-error">{saveError}</p>
    {/if}
    <div class="max-h-[min(70vh,560px)] overflow-auto rounded border border-gray-200 dark:border-gray-700">
      <table class="min-w-full text-left text-sm text-gray-900 dark:text-gray-100">
        <thead class="sticky top-0 z-[1] bg-white dark:bg-gray-800">
          <tr>
            {#each columns as col (columnStableId(col))}
              <th scope="col" class="px-3 py-2 font-semibold" aria-sort={headerAriaSort(col)}>
                {#if isColumnSortable(true, col)}
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 transition-colors hover:text-[var(--color-primary-600,#16a34a)] dark:hover:text-[var(--color-primary-400,#4ade80)]"
                    onclick={() => onHeaderSort(col)}
                  >
                    {col.header}
                    {#if sortGlyph(col)}
                      <span
                        aria-hidden="true"
                        class="text-[10px] leading-none text-gray-400 dark:text-gray-500"
                        data-testid={`modal-sort-indicator-${columnStableId(col)}`}
                      >
                        {sortGlyph(col)}
                      </span>
                    {/if}
                  </button>
                {:else}
                  {col.header}
                {/if}
              </th>
            {/each}
            {#if allowEdit && editMode}
              <th scope="col" class="px-3 py-2 font-semibold">Actions</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each sorted as row (rowKey(row))}
            <tr class="border-t border-gray-100 dark:border-gray-700">
              {#each columns as col (columnStableId(col))}
                <td class={`px-3 py-2 align-top ${col.cellClass ?? ""}`}>
                  {#if allowEdit && editMode && col.editable && col.fieldKey}
                    {#if col.editor === "select" && col.options?.length}
                      <select
                        class={selectClass}
                        value={String(getCellValue(row, col) ?? "")}
                        onchange={(e) => setCellValue(row, col, (e.currentTarget as HTMLSelectElement).value)}
                        aria-invalid={fieldErrors[`${rowKey(row)}:${col.fieldKey}`] ? "true" : "false"}
                        aria-describedby={fieldErrors[`${rowKey(row)}:${col.fieldKey}`]
                          ? errId(rowKey(row), col.fieldKey)
                          : undefined}
                      >
                        {#if col.placeholder}
                          <option value="">{col.placeholder}</option>
                        {/if}
                        {#each col.options ?? [] as opt (opt.value)}
                          <option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
                        {/each}
                      </select>
                    {:else if col.editor === "number"}
                      <input
                        type="number"
                        class={inputClass}
                        value={String(getCellValue(row, col) ?? "")}
                        oninput={(e) => {
                          const v = (e.currentTarget as HTMLInputElement).value;
                          setCellValue(row, col, v === "" ? "" : Number(v));
                        }}
                        aria-invalid={fieldErrors[`${rowKey(row)}:${col.fieldKey}`] ? "true" : "false"}
                        aria-describedby={fieldErrors[`${rowKey(row)}:${col.fieldKey}`]
                          ? errId(rowKey(row), col.fieldKey)
                          : undefined}
                      />
                    {:else}
                      <input
                        type="text"
                        class={inputClass}
                        value={String(getCellValue(row, col) ?? "")}
                        oninput={(e) => setCellValue(row, col, (e.currentTarget as HTMLInputElement).value)}
                        aria-invalid={fieldErrors[`${rowKey(row)}:${col.fieldKey}`] ? "true" : "false"}
                        aria-describedby={fieldErrors[`${rowKey(row)}:${col.fieldKey}`]
                          ? errId(rowKey(row), col.fieldKey)
                          : undefined}
                      />
                    {/if}
                    {#if fieldErrors[`${rowKey(row)}:${col.fieldKey}`]}
                      <p id={errId(rowKey(row), col.fieldKey)} class="mt-1 text-xs text-red-600 dark:text-red-400">
                        {fieldErrors[`${rowKey(row)}:${col.fieldKey}`]}
                      </p>
                    {/if}
                  {:else if col.cell}
                    {@render col.cell(row)}
                  {:else}
                    {col.accessor(row)}
                  {/if}
                </td>
              {/each}
              {#if allowEdit && editMode}
                <td class="px-3 py-2 align-top">
                  <Button
                    type="button"
                    size="xs"
                    disabled={saving || !rowPatch(row)}
                    onclick={() => void saveRow(row)}
                  >
                    Save row
                  </Button>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/snippet}
  {#snippet footer()}
    <div class="flex w-full flex-wrap items-center justify-between gap-2">
      <span class="sr-only" aria-live="polite">{sorted.length} rows</span>
      {#if allowEdit && editMode}
        <Button type="button" color="alternative" onclick={() => (open = false)}>Close</Button>
        <Button type="button" disabled={saving || !hasAnyDirty} onclick={() => void saveAllDirty()}>
          Save all changes
        </Button>
      {:else}
        <Button type="button" onclick={() => (open = false)}>Close</Button>
      {/if}
    </div>
  {/snippet}
</Modal>
