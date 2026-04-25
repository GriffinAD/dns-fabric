<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import Card from "flowbite-svelte/Card.svelte";
  import Input from "flowbite-svelte/Input.svelte";
  import Table from "flowbite-svelte/Table.svelte";
  import TableBody from "flowbite-svelte/TableBody.svelte";
  import TableBodyCell from "flowbite-svelte/TableBodyCell.svelte";
  import TableBodyRow from "flowbite-svelte/TableBodyRow.svelte";
  import TableHead from "flowbite-svelte/TableHead.svelte";
  import TableHeadCell from "flowbite-svelte/TableHeadCell.svelte";
  import type { Snippet } from "svelte";

  import BaseDataTableModal from "./BaseDataTableModal.svelte";
  import BasePagination from "./BasePagination.svelte";
  import InlineSelectEditor from "./InlineSelectEditor.svelte";
  import type { BaseDataTableColumn, BaseDataTableSettingsPatch } from "./baseDataTable";
  import {
    columnStableId,
    defaultBaseDataTableSettings,
    isColumnSortable,
    mergeBaseDataTableSettings,
  } from "./baseDataTable";
  import {
    buildCsvExport,
    buildJsonExport,
    exportFilenameBase,
    rowsForExport,
    triggerDownload,
  } from "./tableExport";
  import {
    cycleSortDirection,
    filterRowsForTable,
    paginateRows,
    sortRowsWithState,
    type TableSortState,
  } from "./tableRowModel";
  import { hasValidationErrors, validateDirtyRowFields } from "./tableValidation";

  let {
    title,
    items,
    err,
    loading = false,
    emptyText,
    noMatchesText = "No rows match the current filter.",
    compact,
    columns,
    rowKey,
    compactSummary,
    fullSingle,
    maxHeightClass = "max-h-[480px]",
    settings: settingsPatch = undefined,
    onRetry,
    onRefresh,
    onCommit,
    jsonPrettyExport = true,
    searchPlaceholder = "Search…",
    titleDomId: titleDomIdProp,
  }: {
    title: string;
    items: unknown[];
    err: string | null;
    loading?: boolean;
    emptyText: string;
    noMatchesText?: string;
    compact: boolean;
    columns: BaseDataTableColumn[];
    rowKey: (row: unknown) => string;
    compactSummary?: Snippet;
    fullSingle?: Snippet;
    maxHeightClass?: string;
    settings?: BaseDataTableSettingsPatch;
    onRetry?: () => void;
    onRefresh?: () => void;
    onCommit?: (args: { rowId: string; patch: Record<string, unknown> }) => void | Promise<void>;
    jsonPrettyExport?: boolean;
    searchPlaceholder?: string;
    titleDomId?: string;
  } = $props();

  const settings = $derived(mergeBaseDataTableSettings(defaultBaseDataTableSettings, settingsPatch ?? {}));

  const titleDomId = $derived(titleDomIdProp ?? `base-table-title-${title.replaceAll(/\s+/g, "-").toLowerCase()}`);

  const visibleColumns = $derived(columns.filter((c) => !compact || !c.hideWhenCompact));

  let filterQuery = $state("");
  let sortState = $state<TableSortState>({ columnId: null, direction: null });
  let page = $state(0);
  const configuredPageSize = $derived(Math.max(1, Math.floor(settings.pageSize)));
  let pageSize = $state(10);
  let pageSizeSelectValue = $state("10");
  let gotoPageValue = $state<string | number>("");
  let modalOpen = $state(false);
  let exportMenuOpen = $state(false);
  let exportDefault = $state<"json" | "csv">("json");
  let announce = $state("");
  let showAllRows = $state(false);
  let editMode = $state(false);
  let baseline = $state<Record<string, Record<string, unknown>>>({});
  let edits = $state<Record<string, Record<string, unknown>>>({});
  let fieldErrors = $state<Record<string, string>>({});
  let saveError = $state<string | null>(null);
  let saving = $state(false);

  const initialSortState = $derived.by((): TableSortState => {
    const colId = settings.defaultSortColumnId;
    const dir = settings.defaultSortDirection;
    if (!settings.allowSort || !colId || !dir) {
      return { columnId: null, direction: null };
    }
    const col = visibleColumns.find((c) => columnStableId(c) === colId);
    if (!col || !isColumnSortable(settings.allowSort, col)) {
      return { columnId: null, direction: null };
    }
    return { columnId: colId, direction: dir };
  });

  $effect(() => {
    sortState = initialSortState;
  });

  const filtered = $derived(filterRowsForTable(items, visibleColumns, filterQuery, settings.allowFilter));

  const sorted = $derived(sortRowsWithState(filtered, visibleColumns, sortState, settings.allowSort));

  const inlineExpandedMode = $derived(settings.interactionMode === "inline");
  const pagingEnabled = $derived(settings.allowPaging && (!inlineExpandedMode || !showAllRows));
  const editableColumns = $derived(visibleColumns.filter((col) => col.editable && col.fieldKey));
  const refreshInHeader = $derived(
    settings.allowRefresh &&
      !!onRefresh &&
      !settings.allowExportCsv &&
      !settings.allowExportJson &&
      !settings.allowFilter &&
      !settings.allowModal &&
      !inlineExpandedMode,
  );

  const pageData = $derived(
    pagingEnabled ? paginateRows(sorted, page, pageSize) : { slice: sorted, totalPages: 1, page: 0 },
  );
  const pageSizeOptions = $derived.by(() => {
    const options = new Set([5, 10, 25, 50]);
    options.add(pageSize);
    return Array.from(options).sort((a, b) => a - b);
  });

  const displayRows = $derived(pageData.slice);

  const filterActive = $derived(settings.allowFilter && filterQuery.trim().length > 0);
  const filterHintText = $derived(`Filters rows by visible columns. ${sorted.length} rows match.`);
  const rowCountText = $derived(`${sorted.length} rows`);
  $effect(() => {
    void sorted.length;
    void pageData.totalPages;
    if (page > pageData.totalPages - 1) {
      page = Math.max(0, pageData.totalPages - 1);
    }
  });

  $effect(() => {
    pageSize = configuredPageSize;
    pageSizeSelectValue = String(configuredPageSize);
  });

  $effect(() => {
    if (!inlineExpandedMode) {
      showAllRows = false;
      editMode = false;
      saveError = null;
    }
  });

  $effect(() => {
    const nextBaseline: Record<string, Record<string, unknown>> = {};
    for (const row of items) {
      const rid = rowKey(row);
      nextBaseline[rid] = {};
      for (const col of editableColumns) {
        const fk = col.fieldKey!;
        nextBaseline[rid][fk] = col.getEditValue ? col.getEditValue(row) : col.accessor(row);
      }
    }
    baseline = nextBaseline;
  });

  function stableString(v: unknown): string {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function displayString(v: unknown): string {
    return v === null || v === undefined ? "" : String(v);
  }

  function getCellValue(row: unknown, col: BaseDataTableColumn): unknown {
    const rid = rowKey(row);
    const fk = col.fieldKey;
    if (fk && edits[rid]?.[fk] !== undefined) return edits[rid][fk];
    return col.getEditValue ? col.getEditValue(row) : col.accessor(row);
  }

  function setCellValue(row: unknown, col: BaseDataTableColumn, value: unknown) {
    const rid = rowKey(row);
    const fk = col.fieldKey as string;
    const nextRow = { ...(edits[rid] ?? {}), [fk]: value };
    edits = { ...edits, [rid]: nextRow };
    const ek = `${rid}:${fk}`;
    if (fieldErrors[ek]) {
      const { [ek]: _, ...rest } = fieldErrors;
      fieldErrors = rest;
    }
  }

  function currentRowValues(row: unknown): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const col of editableColumns) {
      out[col.fieldKey!] = getCellValue(row, col);
    }
    return out;
  }

  function rowPatch(row: unknown): Record<string, unknown> | null {
    const rid = rowKey(row);
    const patch: Record<string, unknown> = {};
    for (const col of editableColumns) {
      const fk = col.fieldKey!;
      const cur = getCellValue(row, col);
      const base = baseline[rid]?.[fk];
      if (stableString(cur) !== stableString(base)) {
        if (col.setPatchValue) {
          col.setPatchValue(patch, cur);
        } else {
          patch[fk] = cur;
        }
      }
    }
    return Object.keys(patch).length > 0 ? patch : null;
  }

  async function saveRow(row: unknown) {
    saveError = null;
    const patch = rowPatch(row);
    if (!patch || !onCommit) return;
    const rid = rowKey(row);
    const errs = validateDirtyRowFields(row, editableColumns, currentRowValues(row));
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
    while (guard++ < displayRows.length + 2) {
      const next = displayRows.find((row) => rowPatch(row));
      if (!next) break;
      await saveRow(next);
      if (saveError) break;
    }
  }

  const hasAnyDirty = $derived(displayRows.some((row) => rowPatch(row) !== null));

  function errId(rid: string, fk: string): string {
    return `table-err-${rid}-${fk}`;
  }

  function onHeaderSort(col: BaseDataTableColumn) {
    const id = columnStableId(col);
    if (sortState.columnId !== id) {
      sortState = { columnId: id, direction: "asc" };
      announce = `Sorted by ${col.header}, ascending`;
    } else {
      const next = cycleSortDirection(sortState.direction);
      sortState = { columnId: next === null ? null : id, direction: next };
      announce = next === "desc" ? `Sorted by ${col.header}, descending` : "Sort cleared";
    }
    page = 0;
  }

  function headerAriaSort(col: BaseDataTableColumn): "none" | "ascending" | "descending" | undefined {
    if (!isColumnSortable(settings.allowSort, col)) return undefined;
    const id = columnStableId(col);
    if (sortState.columnId !== id || !sortState.direction) return "none";
    return sortState.direction === "asc" ? "ascending" : "descending";
  }

  function sortGlyph(col: BaseDataTableColumn): "▲" | "▼" | "" {
    const id = columnStableId(col);
    if (sortState.columnId !== id || !sortState.direction) return "";
    return sortState.direction === "asc" ? "▲" : "▼";
  }

  function exportWorking() {
    const rows = rowsForExport(items, sorted, settings.exportScope);
    return { rows, cols: visibleColumns };
  }

  function gotoPageSubmit() {
    const raw = String(gotoPageValue).trim();
    if (raw.length === 0) return;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      gotoPageValue = "";
      return;
    }
    const clamped = Math.max(1, Math.min(pageData.totalPages, parsed));
    page = clamped - 1;
    gotoPageValue = String(clamped);
    announce = `Page ${clamped} of ${pageData.totalPages}`;
  }

  function doExportCsv() {
    try {
      const { rows, cols } = exportWorking();
      const body = buildCsvExport(rows, cols, { compact });
      triggerDownload(exportFilenameBase(title, "csv"), "text/csv;charset=utf-8", body);
      announce = `Exported ${exportFilenameBase(title, "csv")}`;
    } catch (e: unknown) {
      announce = e instanceof Error ? e.message : "Export failed";
    }
  }

  function doExportJson() {
    try {
      const { rows, cols } = exportWorking();
      const body = buildJsonExport(rows, cols, { compact, pretty: jsonPrettyExport });
      triggerDownload(exportFilenameBase(title, "json"), "application/json;charset=utf-8", body);
      announce = `Exported ${exportFilenameBase(title, "json")}`;
    } catch (e: unknown) {
      announce = e instanceof Error ? e.message : "Export failed";
    }
  }

  function runExport(kind: "json" | "csv") {
    exportDefault = kind;
    if (kind === "csv") {
      doExportCsv();
      return;
    }
    doExportJson();
  }

  const theadClass = $derived(
    settings.fixedHeader
      ? "sticky top-0 z-[2] bg-white dark:bg-gray-800"
      : "bg-white dark:bg-gray-800",
  );

  const scrollWrapClass = $derived(
    settings.fixedHeader
      ? "min-h-0 flex-1 overflow-hidden"
      : "min-h-0 flex-1 overflow-auto",
  );
  const cardClass = $derived(
    `box-border !max-w-full w-full min-w-0 ${
      settings.allowPaging ? "" : maxHeightClass
    } flex-1 min-h-0 flex flex-col overflow-hidden`,
  );
  const rowHeightClass = $derived(
    settings.rowHeightMode === "compact"
      ? "py-1 text-xs leading-4"
      : settings.rowHeightMode === "normal"
        ? "py-2 text-sm leading-5"
        : "py-3 text-base leading-6",
  );

  /**
   * Paged mode should show exactly one page worth of rows with no inner scrollbar.
   * Non-paged mode keeps the scroll container behavior.
   */
  const bodyScrollerClass = $derived(
    pagingEnabled
      ? "min-h-0 flex-1 overflow-hidden"
      : "min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]",
  );
</script>

<Card
  size="xl"
  class={cardClass}
  aria-labelledby={titleDomId}
>
  {#snippet children()}
    <div class="flex shrink-0 flex-col gap-2 border-b border-gray-100 p-4 dark:border-gray-700">
      <div class="flex items-start justify-between gap-2">
        <h3
          id={titleDomId}
          class="text-lg font-semibold text-gray-900 dark:text-white"
        >
          {title}
        </h3>
        {#if settings.allowExportCsv || settings.allowExportJson}
          <div class="relative inline-flex items-stretch">
            <Button
              type="button"
              size="sm"
              color="alternative"
              class="!h-9 !rounded-md !rounded-r-none"
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
              class="!h-9 !rounded-md !rounded-l-none border-l-0 px-2"
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
                {#if settings.allowExportJson}
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
                {/if}
                {#if settings.allowExportCsv}
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
                {/if}
              </div>
            {/if}
          </div>
        {:else if refreshInHeader}
          <Button
            type="button"
            size="sm"
            color="alternative"
            class="!h-9 !rounded-md w-9 justify-center px-2"
            aria-label="Refresh table data"
            title="Refresh"
            onclick={() => onRefresh?.()}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
              <path
                fill-rule="evenodd"
                d="M15.312 4.688a7 7 0 1 0 1.64 7.278.75.75 0 1 1 1.448.392A8.5 8.5 0 1 1 16 3.78V2.75a.75.75 0 0 1 1.5 0V6.5a.75.75 0 0 1-.75.75H13a.75.75 0 0 1 0-1.5h2.312V4.688Z"
                clip-rule="evenodd"
              />
            </svg>
          </Button>
        {/if}
      </div>
      <div class="sr-only" aria-live="polite">{announce}</div>
      {#if settings.allowFilter || settings.allowModal || inlineExpandedMode || (settings.allowRefresh && !refreshInHeader) || (settings.allowEdit && inlineExpandedMode)}
        <div
          role="toolbar"
          aria-label={`${title} table actions`}
          class="flex flex-wrap items-center gap-2"
        >
          {#if settings.allowFilter}
            <div class="min-w-[12rem] flex-1">
              <label for={`${titleDomId}-filter`} class="sr-only">Filter rows</label>
              <Input
                id={`${titleDomId}-filter`}
                type="search"
                placeholder={searchPlaceholder}
                bind:value={filterQuery}
                class="w-full"
                aria-describedby={`${titleDomId}-filter-hint`}
              />
              <p id={`${titleDomId}-filter-hint`} class="sr-only">
                {@html filterHintText}
              </p>
            </div>
            {#if filterQuery.trim().length > 0}
              <span class="mr-2 text-sm text-gray-600 dark:text-gray-300" data-testid="table-row-count">{@html rowCountText}</span>
            {/if}
          {/if}
          {#if settings.allowModal || inlineExpandedMode}
            <Button
              type="button"
              size="sm"
              class="!h-9 !rounded-md"
              onclick={() => {
                if (inlineExpandedMode) {
                  showAllRows = !showAllRows;
                  announce = showAllRows ? "Switched to paged rows" : "Showing all rows";
                  return;
                }
                modalOpen = true;
              }}
            >
              {inlineExpandedMode ? (showAllRows ? "Show paged" : "View all") : "View all"}
            </Button>
          {/if}
          {#if inlineExpandedMode && settings.allowEdit && editMode}
            <Button
              type="button"
              size="sm"
              class="!h-9 !rounded-md"
              disabled={saving || !hasAnyDirty}
              onclick={() => void saveAllDirty()}
            >
              Save all changes
            </Button>
          {/if}
          {#if inlineExpandedMode && settings.allowEdit}
            <Button
              type="button"
              size="sm"
              color="alternative"
              class={editMode
                ? "!h-9 !rounded-md w-9 justify-center px-2 ring-1 ring-green-500/60 text-green-700 dark:text-green-300"
                : "!h-9 !rounded-md w-9 justify-center px-2"}
              aria-label="Toggle edit mode"
              title={editMode ? "Done editing" : "Edit"}
              onclick={() => {
                editMode = !editMode;
              }}
            >
              {#if editMode}
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                  <path
                    fill-rule="evenodd"
                    d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.313a1 1 0 0 1-1.422.008l-3-2.938a1 1 0 0 1 1.398-1.43l2.289 2.24 6.55-6.607a1 1 0 0 1 1.429 0Z"
                    clip-rule="evenodd"
                  />
                </svg>
              {:else}
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                  <path d="M14.69 2.86a2 2 0 0 1 2.828 2.829l-9.4 9.398a1 1 0 0 1-.465.262l-3.5.875a.75.75 0 0 1-.91-.91l.875-3.5a1 1 0 0 1 .262-.465l9.4-9.4ZM13.63 5.04 5.71 12.96l-.49 1.958 1.958-.49 7.92-7.92-1.468-1.468Z" />
                </svg>
              {/if}
            </Button>
          {/if}
          {#if settings.allowRefresh && onRefresh && !refreshInHeader}
            <Button
              type="button"
              size="sm"
              color="alternative"
              class="!h-9 !rounded-md w-9 justify-center px-2"
              aria-label="Refresh table data"
              title="Refresh"
              onclick={() => onRefresh()}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                <path
                  fill-rule="evenodd"
                  d="M15.312 4.688a7 7 0 1 0 1.64 7.278.75.75 0 1 1 1.448.392A8.5 8.5 0 1 1 16 3.78V2.75a.75.75 0 0 1 1.5 0V6.5a.75.75 0 0 1-.75.75H13a.75.75 0 0 1 0-1.5h2.312V4.688Z"
                  clip-rule="evenodd"
                />
              </svg>
            </Button>
          {/if}
        </div>
      {/if}
    </div>

    {#if loading && items.length === 0}
      <div class="flex flex-1 flex-col gap-2 p-4" aria-busy="true" data-testid="table-loading">
        {#each [1, 2, 3, 4, 5] as i (i)}
          <div class="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
        {/each}
      </div>
    {:else if err}
      <div class="flex flex-1 flex-col gap-2 p-4" role="alert">
        <p class="text-sm text-red-600 dark:text-red-400">{err}</p>
        {#if onRetry}
          <Button type="button" size="sm" onclick={() => onRetry()}>Retry</Button>
        {/if}
      </div>
    {:else if items.length === 0}
      <p class="p-4 text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
    {:else if !compact && items.length === 1 && fullSingle}
      <div class="p-4">
        {@render fullSingle()}
      </div>
    {:else if compact && compactSummary}
      <div class="p-4">
        {@render compactSummary()}
      </div>
    {:else if filterActive && sorted.length === 0}
      <p class="p-4 text-sm text-gray-500 dark:text-gray-400">{noMatchesText}</p>
    {:else}
      {#if saveError}
        <p class="px-4 pt-2 text-sm text-red-600 dark:text-red-400" role="alert">{saveError}</p>
      {/if}
      <div class={`flex min-h-0 flex-1 flex-col ${scrollWrapClass}`}>
        <div class={bodyScrollerClass} data-testid="table-body-scroll">
          <Table hoverable={true}>
            <TableHead class={theadClass}>
              {#each visibleColumns as col (columnStableId(col))}
                <TableHeadCell class="bg-inherit" aria-sort={headerAriaSort(col)}>
                  {#if isColumnSortable(settings.allowSort, col)}
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 font-semibold text-gray-900 transition-colors hover:text-green-600 dark:text-white dark:hover:text-green-400"
                      onclick={() => onHeaderSort(col)}
                    >
                      {@html String(col.header)}
                      {#if sortGlyph(col)}
                        <span
                          aria-hidden="true"
                          class="text-[10px] leading-none text-gray-400 dark:text-gray-500"
                          data-testid={`sort-indicator-${columnStableId(col)}`}
                        >
                          {sortGlyph(col)}
                        </span>
                      {/if}
                    </button>
                  {:else}
                    <span class="font-semibold">{col.header}</span>
                  {/if}
                </TableHeadCell>
              {/each}
              {#if inlineExpandedMode && settings.allowEdit && editMode}
                <TableHeadCell class="bg-inherit">Actions</TableHeadCell>
              {/if}
            </TableHead>
            <TableBody>
              {#each displayRows as row (rowKey(row))}
                <TableBodyRow>
                  {#each visibleColumns as col (columnStableId(col))}
                    <TableBodyCell class={`${rowHeightClass} ${col.cellClass ?? ""}`.trim()}>
                      {#if inlineExpandedMode && settings.allowEdit && editMode && col.editable && col.fieldKey}
                        {#if col.editor === "select"}
                          <InlineSelectEditor
                            value={displayString(getCellValue(row, col))}
                            options={col.options}
                            placeholder={col.placeholder}
                            invalid={!!fieldErrors[`${rowKey(row)}:${col.fieldKey}`]}
                            describedBy={fieldErrors[`${rowKey(row)}:${col.fieldKey}`]
                              ? errId(rowKey(row), col.fieldKey)
                              : undefined}
                            onValueChange={(next) => setCellValue(row, col, next)}
                          />
                        {:else if col.editor === "number"}
                          <input
                            type="number"
                            class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm leading-5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            value={String(getCellValue(row, col) ?? "")}
                            oninput={(e) => {
                              const v = (e.currentTarget as HTMLInputElement).value;
                              setCellValue(row, col, v === "" ? "" : Number(v));
                            }}
                            aria-invalid={fieldErrors[`${rowKey(row)}:${col.fieldKey}`] ? "true" : "false"}
                            aria-describedby={fieldErrors[`${rowKey(row)}:${col.fieldKey}`] ? errId(rowKey(row), col.fieldKey) : undefined}
                          />
                        {:else}
                          <input
                            type="text"
                            class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm leading-5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            value={String(getCellValue(row, col) ?? "")}
                            oninput={(e) => setCellValue(row, col, (e.currentTarget as HTMLInputElement).value)}
                            aria-invalid={fieldErrors[`${rowKey(row)}:${col.fieldKey}`] ? "true" : "false"}
                            aria-describedby={fieldErrors[`${rowKey(row)}:${col.fieldKey}`] ? errId(rowKey(row), col.fieldKey) : undefined}
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
                    </TableBodyCell>
                  {/each}
                  {#if inlineExpandedMode && settings.allowEdit && editMode}
                    <TableBodyCell class={rowHeightClass}>
                      <Button
                        type="button"
                        size="xs"
                        class="!h-7 !rounded-md px-2 text-xs leading-4"
                        disabled={saving || !rowPatch(row)}
                        onclick={() => void saveRow(row)}
                      >
                        Save row
                      </Button>
                    </TableBodyCell>
                  {/if}
                </TableBodyRow>
              {/each}
            </TableBody>
          </Table>
        </div>
        {#if pagingEnabled && pageData.totalPages > 1}
          <div class="flex shrink-0 items-center gap-3 border-t border-gray-100 px-4 py-2 dark:border-gray-700">
            <BasePagination
              page={pageData.page + 1}
              totalPages={pageData.totalPages}
              density="default"
              onChange={(nextPage) => {
                page = nextPage - 1;
                announce = `Page ${nextPage} of ${pageData.totalPages}`;
              }}
            />
            <label class="ml-3 inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span class="font-medium tracking-[0.01em]">Page</span>
              <input
                type="text"
                pattern="[0-9]*"
                inputmode="numeric"
                class="h-8 w-16 rounded-md border border-gray-300 bg-white px-2 text-center text-xs font-medium text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                bind:value={gotoPageValue}
                aria-label={`Go to page, between 1 and ${pageData.totalPages}`}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    gotoPageSubmit();
                  }
                }}
              />
            </label>
            <label class="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span class="font-medium tracking-[0.01em]">Page size</span>
              <select
                class="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                bind:value={pageSizeSelectValue}
                aria-label="Rows per page"
                onchange={(event) => {
                  pageSizeSelectValue = (event.currentTarget as HTMLSelectElement).value;
                  const next = Number.parseInt(pageSizeSelectValue, 10);
                  pageSize = Number.isNaN(next) ? 10 : next;
                  pageSizeSelectValue = String(pageSize);
                  page = 0;
                  announce = `Page size ${pageSize}`;
                }}
              >
                {#each pageSizeOptions as option (option)}
                  <option value={String(option)}>{option}</option>
                {/each}
              </select>
            </label>
          </div>
        {/if}
      </div>
    {/if}
  {/snippet}
</Card>

{#if settings.allowModal && !inlineExpandedMode}
  <BaseDataTableModal
    bind:open={modalOpen}
    title={`All ${title}`}
    {items}
    columns={visibleColumns}
    {rowKey}
    allowEdit={settings.allowEdit}
    {onCommit}
    {compact}
    {jsonPrettyExport}
    defaultSortColumnId={settings.defaultSortColumnId}
    defaultSortDirection={settings.defaultSortDirection}
  />
{/if}
