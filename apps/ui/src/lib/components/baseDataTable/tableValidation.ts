import type { BaseDataTableColumn } from "./baseDataTable";

/**
 * Locked v1 order: Zod on raw value first, then column `validate(value, row)`
 * where `value` is Zod output when schema present, else raw.
 */
export function validateCellValue(
  raw: unknown,
  row: unknown,
  column: Pick<BaseDataTableColumn, "validate" | "zodSchema">,
): string | null {
  let value: unknown = raw;
  const schema = column.zodSchema;
  if (schema) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const msg = issue?.message?.trim();
      return msg ? msg : "Invalid value";
    }
    value = parsed.data;
  }
  if (column.validate) {
    return column.validate(value, row);
  }
  return null;
}

export type DirtyFieldKey = string;

/** `fieldKey` → error message, null means valid. */
export function validateDirtyRowFields(
  row: unknown,
  columns: BaseDataTableColumn[],
  dirty: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const col of columns) {
    if (!col.editable || !col.fieldKey) continue;
    if (!(col.fieldKey in dirty)) continue;
    const raw = dirty[col.fieldKey];
    const msg = validateCellValue(raw, row, col);
    if (msg) errors[col.fieldKey] = msg;
  }
  return errors;
}

export function hasValidationErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}
