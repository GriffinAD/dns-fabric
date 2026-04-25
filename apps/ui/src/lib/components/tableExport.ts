import type { BaseDataTableColumn, BaseDataTableExportScope } from "./baseDataTable";
import { columnStableId } from "./baseDataTable";

const CSV_BOM = "\uFEFF";

/** RFC 4180 style: double quotes escaped by doubling; wrap when needed. */
export function escapeCsvCell(value: string): string {
  const needsQuote = /[",\r\n]/.test(value);
  const escaped = value.replaceAll('"', '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export function slugFromTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "") || "export";
}

export function exportFilenameBase(title: string, ext: "csv" | "json"): string {
  const iso = new Date().toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  return `${slugFromTitle(title)}-${iso}.${ext}`;
}

function visibleColumns(columns: BaseDataTableColumn[], compact: boolean): BaseDataTableColumn[] {
  return columns.filter((c) => !compact || !c.hideWhenCompact);
}

function exportValueForColumn(row: unknown, col: BaseDataTableColumn): unknown {
  if (col.getEditValue) {
    return col.getEditValue(row);
  }
  return col.accessor(row);
}

function rowObjectForExport(row: unknown, columns: BaseDataTableColumn[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (col.exportable === false) continue;
    const key = col.fieldKey ?? columnStableId(col);
    out[key] = exportValueForColumn(row, col);
  }
  return out;
}

export function buildJsonExport(
  rows: unknown[],
  columns: BaseDataTableColumn[],
  opts: { compact: boolean; pretty: boolean },
): string {
  const cols = visibleColumns(columns, opts.compact);
  const arr = rows.map((row) => rowObjectForExport(row, cols));
  return JSON.stringify(arr, null, opts.pretty ? 2 : undefined);
}

export function buildCsvExport(rows: unknown[], columns: BaseDataTableColumn[], opts: { compact: boolean }): string {
  const cols = visibleColumns(columns, opts.compact);
  const headers = cols.map((c) => escapeCsvCell(c.exportHeader ?? c.header));
  const lines = [headers.join(",")];
  for (const row of rows) {
    const cells = cols.map((c) => escapeCsvCell(String(exportValueForColumn(row, c) ?? "")));
    lines.push(cells.join(","));
  }
  return CSV_BOM + lines.join("\r\n");
}

export function triggerDownload(filename: string, mime: string, body: string): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function rowsForExport(
  allRows: unknown[],
  workingRows: unknown[],
  scope: BaseDataTableExportScope,
): unknown[] {
  return scope === "all" ? [...allRows] : [...workingRows];
}
