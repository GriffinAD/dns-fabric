<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import { onMount } from "svelte";

  import BaseDataTable from "../components/BaseDataTable.svelte";
  import type { BaseDataTableColumn } from "../components/baseDataTable";
  import { defaultBaseDataTableSettings, mergeBaseDataTableSettings } from "../components/baseDataTable";
  import type { DataGateway } from "../dataGateway";
  import type { AdminLogRecord, LogLevel } from "../api/types";

  let { gateway }: { gateway: DataGateway } = $props();
  type AdminLogRow = AdminLogRecord & { _row_id: string };

  const levels: LogLevel[] = ["CRITICAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"];
  const queryLimit = 25;
  const viewAllLimit = 500;

  let service = $state("");
  let operation = $state("");
  let subcategory = $state("");
  let mode = $state("");
  let level = $state<LogLevel | "">("");
  let fromTs = $state("");
  let toTs = $state("");
  let rows = $state<AdminLogRow[]>([]);
  let err = $state<string | null>(null);
  let loading = $state(false);
  let activeQueryId = 0;
  let totalCount = $state<number | null>(null);
  let totalPages = $state(1);
  let currentPage = $state(1);
  let currentPageSize = $state(queryLimit);
  let serverPagingMode = $state(true);
  const title = $derived(`Logging (${totalCount ?? rows.length})`);

  const columns = $derived.by(
    (): BaseDataTableColumn[] => [
      {
        header: "ts",
        accessor: (row) => (row as AdminLogRow).ts,
        cellClass: "font-mono !text-gray-900 dark:!text-gray-100",
      },
      {
        header: "level",
        accessor: (row) => (row as AdminLogRow).level,
        cellClass: "font-mono !text-gray-900 dark:!text-gray-100",
      },
      {
        header: "service",
        accessor: (row) => (row as AdminLogRow).service,
        cellClass: "font-mono !text-gray-900 dark:!text-gray-100",
      },
      {
        header: "operation",
        accessor: (row) => (row as AdminLogRow).operation,
        cellClass: "!text-gray-900 dark:!text-gray-100",
      },
      {
        header: "event",
        accessor: (row) => (row as AdminLogRow).event,
        cellClass: "!text-gray-900 dark:!text-gray-100",
      },
      {
        header: "message",
        accessor: (row) => (row as AdminLogRow).message,
        cellClass: "!text-gray-900 dark:!text-gray-100",
      },
    ],
  );

  const tableSettings = mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
    allowEdit: false,
    allowRefresh: true,
    allowModal: false,
    allowExportCsv: false,
    allowExportJson: false,
    allowFilter: false,
    autoPageSize: false,
    pageSize: 25,
  });

  function parseRows(items: unknown[]): AdminLogRow[] {
    return items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item, idx) => ({
        ts: String(item.ts ?? ""),
        level: String(item.level ?? "INFO") as LogLevel,
        event: String(item.event ?? ""),
        message: String(item.message ?? ""),
        service: String(item.service ?? ""),
        operation: String(item.operation ?? ""),
        subcategory: String(item.subcategory ?? ""),
        mode: item.mode == null ? null : String(item.mode),
        request_id: item.request_id == null ? null : String(item.request_id),
        trace_id: item.trace_id == null ? null : String(item.trace_id),
        actor: item.actor == null ? null : String(item.actor),
        error_type: item.error_type == null ? null : String(item.error_type),
        error_message: item.error_message == null ? null : String(item.error_message),
        _row_id: [
          idx,
          String(item.ts ?? ""),
          String(item.event ?? ""),
          String(item.operation ?? ""),
          String(item.request_id ?? ""),
        ].join(":"),
      }));
  }

  function buildFilterParams(limit: number, cursorValue: number): URLSearchParams {
    const params = new URLSearchParams();
    if (service) params.set("service", service);
    if (operation) params.set("operation", operation);
    if (subcategory) params.set("subcategory", subcategory);
    if (mode) params.set("mode", mode);
    if (level) params.set("level", level);
    if (fromTs) params.set("from", fromTs);
    if (toTs) params.set("to", toTs);
    params.set("cursor", String(Math.max(0, cursorValue)));
    params.set("page_size", String(limit));
    params.set("_t", String(Date.now()));
    return params;
  }

  async function fetchLogsPage({
    cursorValue,
    limit,
  }: {
    cursorValue: number;
    limit: number;
  }): Promise<{
    rows: AdminLogRow[];
    totalCount: number | null;
  }> {
    const params = buildFilterParams(limit, cursorValue);
    const response = await fetch(`/api/v1/admin/logs?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Admin logs request failed (${response.status})`);
    }
    const payload = (await response.json()) as {
      items?: unknown[];
      total_count?: unknown;
    };
    return {
      rows: Array.isArray(payload.items) ? parseRows(payload.items) : [],
      totalCount:
        typeof payload.total_count === "number" && Number.isFinite(payload.total_count)
          ? payload.total_count
          : null,
    };
  }

  async function runQuery(page: number = 1, pageSize: number = currentPageSize): Promise<void> {
    activeQueryId += 1;
    const queryId = activeQueryId;
    loading = true;
    err = null;
    serverPagingMode = true;
    currentPage = page;
    currentPageSize = pageSize;
    const timeoutId = setTimeout(() => {
      if (queryId !== activeQueryId) return;
      err = "Log query timed out after 8 seconds";
      loading = false;
    }, 8000);
    try {
      const cursorValue = Math.max(0, (page - 1) * pageSize);
      let responsePage = await fetchLogsPage({ cursorValue, limit: pageSize });
      if (responsePage.rows.length === 0 && page === 1) {
        await gateway.getHealth().catch(() => undefined);
        responsePage = await fetchLogsPage({ cursorValue, limit: pageSize });
      }
      if (queryId !== activeQueryId) return;
      rows = responsePage.rows;
      totalCount = responsePage.totalCount;
      totalPages = Math.max(
        1,
        responsePage.totalCount ? Math.ceil(responsePage.totalCount / pageSize) : 1,
      );
    } catch (e: unknown) {
      if (queryId !== activeQueryId) return;
      err = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timeoutId);
      if (queryId !== activeQueryId) return;
      loading = false;
    }
  }

  function cancelQuery(): void {
    activeQueryId += 1;
    loading = false;
    err = "Query cancelled.";
  }

  onMount(() => {
    void runQuery();
  });

  async function loadViewAll(): Promise<void> {
    activeQueryId += 1;
    const queryId = activeQueryId;
    loading = true;
    err = null;
    try {
      const page = await fetchLogsPage({ cursorValue: 0, limit: viewAllLimit });
      if (queryId !== activeQueryId) return;
      serverPagingMode = false;
      currentPage = 1;
      currentPageSize = queryLimit;
      rows = page.rows;
      // In "View all" mode we intentionally show retrieved rows (API-capped).
      totalCount = page.rows.length;
    } catch (e: unknown) {
      if (queryId !== activeQueryId) return;
      err = e instanceof Error ? e.message : String(e);
    } finally {
      if (queryId !== activeQueryId) return;
      loading = false;
    }
  }

  async function onServerPageChange(nextPage: number, pageSize: number): Promise<void> {
    await runQuery(nextPage, pageSize);
  }
</script>

<div data-testid="admin-logs-page" class="flex w-full flex-col gap-4">
  <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Logging</h2>
  <p class="text-sm text-gray-600 dark:text-gray-400">
    Global structured logger query with server-side filtering.
  </p>

  <Card class="w-full max-w-none">
    {#snippet children()}
      <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
        <select
          class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          bind:value={level}
        >
          <option value="">all levels</option>
          {#each levels as lv}
            <option value={lv}>{lv}</option>
          {/each}
        </select>
        <input
          class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="service"
          bind:value={service}
        />
        <input
          class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="operation"
          bind:value={operation}
        />
        <input
          class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="subcategory"
          bind:value={subcategory}
        />
        <input
          class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="mode"
          bind:value={mode}
        />
        <input
          class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 md:col-span-1 xl:col-start-1 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="from (ISO)"
          bind:value={fromTs}
        />
        <input
          class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 md:col-span-1 xl:col-start-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="to (ISO)"
          bind:value={toTs}
        />
      </div>
      <div class="mt-3 flex gap-2">
        {#if loading}
          <button
            type="button"
            class="rounded bg-gray-600 px-3 py-1 text-white hover:bg-gray-700"
            onclick={cancelQuery}
          >
            Cancel
          </button>
        {/if}
      </div>
      {#if loading}
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Loading logs…</p>
      {/if}
    {/snippet}
  </Card>

  {#if err}
    <p class="text-sm text-red-600 dark:text-red-400">{err}</p>
  {/if}
  <div class="w-full">
    <BaseDataTable
      {title}
      items={rows}
      err={null}
      loading={false}
      emptyText="No logs found."
      compact={false}
      {columns}
      rowKey={(row) => (row as AdminLogRow)._row_id}
      settings={tableSettings}
      refreshLabel="Query logs"
      onRefresh={runQuery}
      onRetry={runQuery}
      onViewAll={loadViewAll}
      serverPaging={serverPagingMode}
      serverPage={currentPage}
      serverTotalPages={totalPages}
      onServerPageChange={onServerPageChange}
      serverRowCount={totalCount}
    />
  </div>
</div>
