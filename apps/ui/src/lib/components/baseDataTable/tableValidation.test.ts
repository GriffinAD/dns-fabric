import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { BaseDataTableColumn } from "./baseDataTable";
import { hasValidationErrors, validateCellValue, validateDirtyRowFields } from "./tableValidation";

describe("tableValidation", () => {
  it("runs validate only when no zod", () => {
    const col: Pick<BaseDataTableColumn, "validate" | "zodSchema"> = {
      validate: (v) => (v === "ok" ? null : "bad"),
    };
    expect(validateCellValue("ok", {}, col)).toBeNull();
    expect(validateCellValue("no", {}, col)).toBe("bad");
  });

  it("runs zod then validate", () => {
    const col: Pick<BaseDataTableColumn, "validate" | "zodSchema"> = {
      zodSchema: z.coerce.number().int(),
      validate: (v) => ((v as number) > 5 ? null : "too small"),
    };
    expect(validateCellValue("3", {}, col)).toBe("too small");
    expect(validateCellValue("10", {}, col)).toBeNull();
    expect(validateCellValue("nope", {}, col)).toBeTruthy();
  });

  it("validateDirtyRowFields collects field errors", () => {
    const columns: BaseDataTableColumn[] = [
      {
        header: "N",
        fieldKey: "n",
        accessor: () => "",
        editable: true,
        zodSchema: z.coerce.number().min(1),
      },
    ];
    const row = {};
    expect(validateDirtyRowFields(row, columns, { n: "0" }).n).toBeTruthy();
    expect(validateDirtyRowFields(row, columns, { n: "2" })).toEqual({});
  });

  it("hasValidationErrors", () => {
    expect(hasValidationErrors({})).toBe(false);
    expect(hasValidationErrors({ a: "e" })).toBe(true);
  });

  it("validateCellValue maps empty zod message to Invalid value", () => {
    const col: Pick<BaseDataTableColumn, "validate" | "zodSchema"> = {
      zodSchema: z.string().refine(() => false, { message: "" }),
    };
    expect(validateCellValue("x", {}, col)).toBe("Invalid value");
  });

  it("validateDirtyRowFields skips non-editable and missing dirty keys", () => {
    const columns: BaseDataTableColumn[] = [
      { header: "A", fieldKey: "a", accessor: () => "", editable: false },
      { header: "B", fieldKey: "b", accessor: () => "", editable: true, validate: () => "err" },
    ];
    expect(validateDirtyRowFields({}, columns, { a: "1" })).toEqual({});
    expect(validateDirtyRowFields({}, columns, {})).toEqual({});
    expect(validateDirtyRowFields({}, columns, { b: "x" })).toEqual({ b: "err" });
  });
});
