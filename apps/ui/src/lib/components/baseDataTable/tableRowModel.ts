import type { BaseDataTableColumn } from "./baseDataTable";
import { columnStableId, isColumnFilterable, isColumnSortable } from "./baseDataTable";

export type SortDirection = "asc" | "desc" | null;

export type TableSortState = {
  columnId: string | null;
  direction: SortDirection;
};

/** Cycle: none → asc → desc → none. */
export function cycleSortDirection(current: SortDirection): SortDirection {
  if (current === null) return "asc";
  if (current === "asc") return "desc";
  return null;
}

export function filterRowsForTable(
  rows: unknown[],
  columns: BaseDataTableColumn[],
  query: string,
  allowFilter: boolean,
): unknown[] {
  if (!allowFilter) return [...rows];
  const trimmed = query.trim();
  if (!trimmed) return [...rows];
  const q = trimmed.toLowerCase();
  return rows.filter((row) =>
    columns.some((col) => {
      if (!isColumnFilterable(allowFilter, col)) return false;
      try {
        return col.accessor(row).toLowerCase().includes(q);
      } catch {
        return false;
      }
    }),
  );
}

function defaultCompare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  const as = String(a);
  const bs = String(b);
  if (as < bs) return -1;
  if (as > bs) return 1;
  return 0;
}

export function sortRowsWithState(
  rows: unknown[],
  columns: BaseDataTableColumn[],
  sortState: TableSortState,
  allowSort: boolean,
): unknown[] {
  if (!allowSort || !sortState.columnId || !sortState.direction) {
    return [...rows];
  }
  const col = columns.find((c) => columnStableId(c) === sortState.columnId);
  if (!col || !isColumnSortable(allowSort, col)) {
    return [...rows];
  }
  const dir = sortState.direction === "asc" ? 1 : -1;
  const indexed = rows.map((row, index) => ({ row, index }));
  indexed.sort((a, b) => {
    let cmp = 0;
    if (col.sortComparator) {
      cmp = col.sortComparator(a.row, b.row);
    } else {
      const va = col.sortKey ? col.sortKey(a.row) : col.accessor(a.row);
      const vb = col.sortKey ? col.sortKey(b.row) : col.accessor(b.row);
      cmp = defaultCompare(va, vb);
    }
    if (cmp !== 0) return cmp * dir;
    return a.index - b.index;
  });
  return indexed.map((x) => x.row);
}

export type PaginateResult = {
  slice: unknown[];
  totalPages: number;
  page: number;
};

export function paginateRows(rows: unknown[], page: number, pageSize: number): PaginateResult {
  const safeSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(rows.length / safeSize));
  const safePage = Math.min(Math.max(0, Math.floor(page)), totalPages - 1);
  const start = safePage * safeSize;
  const slice = rows.slice(start, start + safeSize);
  return { slice, totalPages, page: safePage };
}

/**
 * Derive rows per page from inner height (px). Uses an approximate row height.
 */
export function rowsPerPageFromHeight(innerHeightPx: number, approximateRowPx = 40, minRows = 3, maxRows = 50): number {
  if (!Number.isFinite(innerHeightPx) || innerHeightPx <= 0) return minRows;
  const raw = Math.floor(innerHeightPx / approximateRowPx);
  return Math.min(maxRows, Math.max(minRows, raw));
}

/**
 * Same as {@link rowsPerPageFromHeight}, but when the count **drops** by one,
 * keeps the previous value until height falls clearly below the midpoint
 * between the two thresholds. Stops oscillation when the scrollbar or layout
 * nudges height across a row boundary while `floor(height / rowPx)` flips.
 * (Increases need no extra logic: the first height that yields a larger `raw`
 * is already past the lower threshold.)
 */
export function rowsPerPageFromHeightStable(
  innerHeightPx: number,
  previousRowsPerPage: number,
  approximateRowPx = 40,
  minRows = 3,
  maxRows = 50,
): number {
  const raw = rowsPerPageFromHeight(innerHeightPx, approximateRowPx, minRows, maxRows);
  if (previousRowsPerPage <= 0 || raw >= previousRowsPerPage) return raw;
  const release = (previousRowsPerPage - 0.5) * approximateRowPx;
  if (innerHeightPx >= release) return previousRowsPerPage;
  return raw;
}
