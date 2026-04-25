import { describe, expect, it } from "vitest";

import type { BaseDataTableColumn } from "./baseDataTable";
import {
  cycleSortDirection,
  filterRowsForTable,
  paginateRows,
  rowsPerPageFromHeight,
  rowsPerPageFromHeightStable,
  sortRowsWithState,
} from "./tableRowModel";

const cols: BaseDataTableColumn[] = [
  { header: "Name", accessor: (r) => (r as { name: string }).name },
  { header: "Score", accessor: (r) => String((r as { score: number }).score), sortKey: (r) => (r as { score: number }).score },
];

describe("tableRowModel", () => {
  it("cycles sort direction", () => {
    expect(cycleSortDirection(null)).toBe("asc");
    expect(cycleSortDirection("asc")).toBe("desc");
    expect(cycleSortDirection("desc")).toBe(null);
  });

  it("filters by global substring case-insensitive", () => {
    const rows = [{ name: "Alice", score: 1 }, { name: "Bob", score: 2 }];
    expect(filterRowsForTable(rows, cols, "alice", true)).toEqual([{ name: "Alice", score: 1 }]);
    expect(filterRowsForTable(rows, cols, "", true)).toEqual(rows);
    expect(filterRowsForTable(rows, cols, "nope", true)).toEqual([]);
  });

  it("skips filter when allowFilter false", () => {
    const rows = [{ name: "X", score: 1 }];
    expect(filterRowsForTable(rows, cols, "nope", false)).toEqual(rows);
  });

  it("respects filterable false", () => {
    const c: BaseDataTableColumn[] = [
      { header: "Hidden", accessor: () => "secret", filterable: false },
      { header: "Tag", accessor: (r) => (r as { tag: string }).tag },
    ];
    const rows = [{ tag: "a" }];
    expect(filterRowsForTable(rows, c, "secret", true)).toEqual([]);
  });

  it("sorts with stable tie-breaker", () => {
    const rows = [
      { id: "a", score: 10 },
      { id: "b", score: 10 },
      { id: "c", score: 5 },
    ];
    const scoreCol: BaseDataTableColumn[] = [
      {
        id: "score",
        header: "Score",
        accessor: (r) => String((r as { score: number }).score),
        sortKey: (r) => (r as { score: number }).score,
      },
    ];
    const sorted = sortRowsWithState(rows, scoreCol, { columnId: "score", direction: "desc" }, true);
    expect((sorted[0] as { id: string }).id).toBe("a");
    expect((sorted[1] as { id: string }).id).toBe("b");
    expect((sorted[2] as { id: string }).id).toBe("c");
  });

  it("returns unsorted copy when sort off", () => {
    const rows = [{ n: 2 }, { n: 1 }];
    const c: BaseDataTableColumn[] = [{ header: "N", accessor: (r) => String((r as { n: number }).n) }];
    expect(sortRowsWithState(rows, c, { columnId: null, direction: null }, true)).toEqual(rows);
    expect(sortRowsWithState(rows, c, { columnId: "N", direction: "asc" }, false)).toEqual(rows);
  });

  it("paginates", () => {
    const rows = [1, 2, 3, 4, 5];
    const p0 = paginateRows(rows, 0, 2);
    expect(p0.slice).toEqual([1, 2]);
    expect(p0.totalPages).toBe(3);
    const p2 = paginateRows(rows, 99, 2);
    expect(p2.page).toBe(2);
    expect(p2.slice).toEqual([5]);
  });

  it("derives rows per page from height", () => {
    expect(rowsPerPageFromHeight(0)).toBe(3);
    expect(rowsPerPageFromHeight(400, 40, 3, 50)).toBe(10);
    expect(rowsPerPageFromHeight(99999, 40, 3, 50)).toBe(50);
  });

  it("stabilizes rows-per-page when height jitters just below a shrink", () => {
    expect(rowsPerPageFromHeightStable(439, 11, 40, 3, 50)).toBe(11);
    expect(rowsPerPageFromHeightStable(418, 11, 40, 3, 50)).toBe(10);
  });

  it("allows increases when height clearly supports more rows", () => {
    expect(rowsPerPageFromHeightStable(440, 10, 40, 3, 50)).toBe(11);
    expect(rowsPerPageFromHeightStable(500, 10, 40, 3, 50)).toBe(12);
  });

  it("drops rows-per-page once height is clearly below release", () => {
    expect(rowsPerPageFromHeightStable(419, 11, 40, 3, 50)).toBe(10);
    expect(rowsPerPageFromHeightStable(420, 11, 40, 3, 50)).toBe(11);
    expect(rowsPerPageFromHeightStable(439, 11, 40, 3, 50)).toBe(11);
  });

  it("returns raw when previous is unset or equal", () => {
    expect(rowsPerPageFromHeightStable(400, 0, 40, 3, 50)).toBe(10);
    expect(rowsPerPageFromHeightStable(400, 10, 40, 3, 50)).toBe(10);
  });

  it("uses sortComparator when provided", () => {
    const rows = [{ k: 1 }, { k: 2 }];
    const c: BaseDataTableColumn[] = [
      {
        id: "k",
        header: "K",
        accessor: (r) => String((r as { k: number }).k),
        sortComparator: (a, b) => (b as { k: number }).k - (a as { k: number }).k,
      },
    ];
    const sorted = sortRowsWithState(rows, c, { columnId: "k", direction: "asc" }, true);
    expect((sorted[0] as { k: number }).k).toBe(2);
  });

  it("filters out rows when accessor throws", () => {
    const bad: BaseDataTableColumn[] = [
      { header: "X", accessor: () => { throw new Error("x"); } },
    ];
    expect(filterRowsForTable([{}], bad, "a", true)).toEqual([]);
  });

  it("returns copy when sort column id is unknown", () => {
    const rows = [{ n: 1 }];
    const c: BaseDataTableColumn[] = [{ header: "N", accessor: (r) => String((r as { n: number }).n) }];
    expect(sortRowsWithState(rows, c, { columnId: "missing", direction: "asc" }, true)).toEqual(rows);
  });

  it("returns copy when column is not sortable", () => {
    const rows = [{ n: 1 }];
    const c: BaseDataTableColumn[] = [
      { id: "n", header: "N", accessor: (r) => String((r as { n: number }).n), sortable: false },
    ];
    expect(sortRowsWithState(rows, c, { columnId: "n", direction: "asc" }, true)).toEqual(rows);
  });

  it("sorts strings ascending and descending via defaultCompare", () => {
    const rows = [
      { id: "1", t: "m" },
      { id: "2", t: "a" },
    ];
    const c: BaseDataTableColumn[] = [
      {
        id: "t",
        header: "T",
        accessor: (r) => (r as { t: string }).t,
        sortKey: (r) => (r as { t: string }).t,
      },
    ];
    const asc = sortRowsWithState(rows, c, { columnId: "t", direction: "asc" }, true);
    expect((asc[0] as { id: string }).id).toBe("2");
    const desc = sortRowsWithState(rows, c, { columnId: "t", direction: "desc" }, true);
    expect((desc[0] as { id: string }).id).toBe("1");
  });

  it("sorts numeric keys via defaultCompare numeric branch", () => {
    const rows = [
      { id: "hi", n: 2 },
      { id: "lo", n: 1 },
      { id: "mid", n: 1.5 },
    ];
    const c: BaseDataTableColumn[] = [
      {
        id: "n",
        header: "N",
        accessor: (r) => String((r as { n: number }).n),
        sortKey: (r) => (r as { n: number }).n,
      },
    ];
    const asc = sortRowsWithState(rows, c, { columnId: "n", direction: "asc" }, true);
    expect((asc[0] as { id: string }).id).toBe("lo");
    expect((asc[2] as { id: string }).id).toBe("hi");
  });

  it("stable-sorts equal string keys by original index", () => {
    const rows = [
      { id: "a", tag: "x" },
      { id: "b", tag: "x" },
    ];
    const c: BaseDataTableColumn[] = [
      {
        id: "tag",
        header: "Tag",
        accessor: (r) => (r as { tag: string }).tag,
        sortKey: (r) => (r as { tag: string }).tag,
      },
    ];
    const sorted = sortRowsWithState(rows, c, { columnId: "tag", direction: "asc" }, true);
    expect((sorted[0] as { id: string }).id).toBe("a");
    expect((sorted[1] as { id: string }).id).toBe("b");
  });
});
