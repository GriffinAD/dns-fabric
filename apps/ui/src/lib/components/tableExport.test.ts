import { describe, expect, it, vi } from "vitest";

import type { BaseDataTableColumn } from "./baseDataTable";
import {
  buildCsvExport,
  buildJsonExport,
  escapeCsvCell,
  exportFilenameBase,
  rowsForExport,
  slugFromTitle,
  triggerDownload,
} from "./tableExport";

describe("tableExport", () => {
  it("escapes csv per rfc4180", () => {
    expect(escapeCsvCell("a")).toBe("a");
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("x\ny")).toMatch(/^"/);
  });

  it("slugifies title", () => {
    expect(slugFromTitle("DHCP Clients")).toBe("dhcp-clients");
    expect(slugFromTitle("!!!")).toBe("export");
  });

  it("builds csv with bom", () => {
    const cols: BaseDataTableColumn[] = [{ header: "A", accessor: (r) => (r as { a: string }).a }];
    const csv = buildCsvExport([{ a: "x" }], cols, { compact: false });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("A");
    expect(csv).toContain("x");
  });

  it("builds json pretty", () => {
    const cols: BaseDataTableColumn[] = [
      { header: "Name", fieldKey: "name", accessor: (r) => (r as { name: string }).name },
    ];
    const j = buildJsonExport([{ name: "Z" }], cols, { compact: false, pretty: true });
    expect(j.includes("\n")).toBe(true);
    expect(JSON.parse(j)[0].name).toBe("Z");
  });

  it("skips exportable false columns in json", () => {
    const cols: BaseDataTableColumn[] = [
      { header: "A", fieldKey: "a", accessor: (r) => (r as { a: string }).a },
      { header: "B", fieldKey: "b", accessor: (r) => (r as { b: string }).b, exportable: false },
    ];
    const j = buildJsonExport([{ a: "1", b: "2" }], cols, { compact: false, pretty: false });
    const o = JSON.parse(j)[0] as Record<string, unknown>;
    expect("a" in o).toBe(true);
    expect("b" in o).toBe(false);
  });

  it("builds json using getEditValue when present", () => {
    const cols: BaseDataTableColumn[] = [
      {
        header: "N",
        fieldKey: "n",
        accessor: () => "display",
        getEditValue: (r) => (r as { n: number }).n,
      },
    ];
    const j = buildJsonExport([{ n: 42 }], cols, { compact: false, pretty: false });
    expect(JSON.parse(j)[0].n).toBe(42);
  });

  it("builds csv using getEditValue when present", () => {
    const cols: BaseDataTableColumn[] = [
      {
        header: "N",
        fieldKey: "n",
        accessor: () => "display",
        getEditValue: (r) => (r as { n: number }).n,
      },
    ];
    const csv = buildCsvExport([{ n: 42 }], cols, { compact: false });
    expect(csv).toContain("N");
    expect(csv).toContain("42");
    expect(csv).not.toContain("display");
  });

  it("omits hideWhenCompact columns in compact export", () => {
    const cols: BaseDataTableColumn[] = [
      { header: "A", accessor: (r) => (r as { a: string }).a },
      { header: "B", accessor: (r) => (r as { b: string }).b, hideWhenCompact: true },
    ];
    const csv = buildCsvExport([{ a: "1", b: "2" }], cols, { compact: true });
    expect(csv).toContain("A");
    expect(csv).not.toContain("B");
  });

  it("export filename contains extension", () => {
    const f = exportFilenameBase("Pools", "csv");
    expect(f.endsWith(".csv")).toBe(true);
    expect(f.startsWith("pools-")).toBe(true);
  });

  it("rowsForExport respects scope", () => {
    const all = [1, 2, 3];
    const work = [1];
    expect(rowsForExport(all, work, "visible")).toEqual([1]);
    expect(rowsForExport(all, work, "all")).toEqual(all);
  });

  it("triggerDownload clicks anchor and revokes", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    triggerDownload("t.csv", "text/csv", "a,b");
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    revoke.mockRestore();
  });
});
