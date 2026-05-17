import type { Snippet } from "svelte";
import type { ZodType } from "zod";

/** Select / dropdown option for editable enum-like columns. */
export type BaseDataTableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type BaseDataTableEditorKind = "text" | "number" | "select";

/**
 * Column metadata for {@link import("./BaseDataTable.svelte").default}.
 * Rich cells: optional Svelte 5 snippet; the shell owns the `<td>` wrapper.
 */
export type BaseDataTableColumn = {
  /** Stable id for sort state and export keys; defaults to `header` when omitted. */
  id?: string;
  header: string;
  accessor: (row: unknown) => string;
  hideWhenCompact?: boolean;
  cellClass?: string;
  /** When false, column is excluded from header sort even if `settings.allowSort`. */
  sortable?: boolean;
  sortKey?: (row: unknown) => string | number;
  sortComparator?: (a: unknown, b: unknown) => number;
  /** When false, column is ignored by the global filter. Default: participates. */
  filterable?: boolean;
  fieldKey?: string;
  editable?: boolean;
  editor?: BaseDataTableEditorKind;
  options?: BaseDataTableSelectOption[];
  placeholder?: string;
  validate?: (value: unknown, row: unknown) => string | null;
  /** When set, parsed value is passed to `validate` (Zod runs first). */
  zodSchema?: ZodType<unknown>;
  exportable?: boolean;
  exportHeader?: string;
  getEditValue?: (row: unknown) => unknown;
  setPatchValue?: (patch: Record<string, unknown>, value: unknown) => void;
  cell?: Snippet<[unknown]>;
};

export type BaseDataTableExportScope = "visible" | "all";
export type BaseDataTableRowHeightMode = "large" | "normal" | "compact";
export type BaseDataTableDefaultSortDirection = "asc" | "desc";
export type BaseDataTableInteractionMode = "modal" | "inline";
export type BaseDataTableInteractionModePatch = BaseDataTableInteractionMode | "inline-expanded";

export type BaseDataTableSettings = {
  allowSort: boolean;
  allowFilter: boolean;
  fixedHeader: boolean;
  allowPaging: boolean;
  autoPageSize: boolean;
  pageSize: number;
  rowHeightMode: BaseDataTableRowHeightMode;
  allowExportCsv: boolean;
  allowExportJson: boolean;
  allowModal: boolean;
  allowRefresh: boolean;
  allowEdit: boolean;
  exportScope: BaseDataTableExportScope;
  defaultSortColumnId?: string;
  defaultSortDirection?: BaseDataTableDefaultSortDirection;
  interactionMode: BaseDataTableInteractionMode;
};

export const defaultBaseDataTableSettings: BaseDataTableSettings = {
  allowSort: true,
  allowFilter: true,
  fixedHeader: true,
  allowPaging: true,
  autoPageSize: true,
  pageSize: 10,
  rowHeightMode: "normal",
  allowExportCsv: true,
  allowExportJson: true,
  allowModal: true,
  allowRefresh: false,
  allowEdit: true,
  exportScope: "visible",
  interactionMode: "inline",
};

/** Partial settings from layout JSON (`tile.options.table`). */
export type BaseDataTableSettingsPatch = Partial<Omit<BaseDataTableSettings, "interactionMode">> & {
  interactionMode?: BaseDataTableInteractionModePatch;
};

function normalizeInteractionMode(
  mode: BaseDataTableSettingsPatch["interactionMode"] | undefined,
): BaseDataTableInteractionMode | undefined {
  if (mode === "inline-expanded") return "inline";
  return mode;
}

export function mergeBaseDataTableSettings(
  base: BaseDataTableSettings,
  ...patches: (BaseDataTableSettingsPatch | undefined | null)[]
): BaseDataTableSettings {
  let out: BaseDataTableSettings = { ...base };
  for (const p of patches) {
    if (!p) continue;
    out = {
      ...out,
      ...p,
      interactionMode: normalizeInteractionMode(p.interactionMode) ?? out.interactionMode,
    };
  }
  return out;
}

export function columnStableId(col: BaseDataTableColumn): string {
  return col.id ?? col.header;
}

export function isColumnSortable(allowSort: boolean, col: BaseDataTableColumn): boolean {
  return allowSort && col.sortable !== false;
}

export function isColumnFilterable(allowFilter: boolean, col: BaseDataTableColumn): boolean {
  return allowFilter && col.filterable !== false;
}

/** Legacy `TablePluginShell` feature set: plain titled table only. */
export const tableShellLegacySettings: BaseDataTableSettings = mergeBaseDataTableSettings(
  defaultBaseDataTableSettings,
  {
    allowSort: false,
    allowFilter: false,
    allowPaging: false,
    allowExportCsv: false,
    allowExportJson: false,
    allowModal: false,
    allowRefresh: false,
    allowEdit: false,
  },
);
