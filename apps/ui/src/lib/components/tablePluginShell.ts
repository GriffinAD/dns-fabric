/** Column model for `TablePluginShell.svelte` (UI_ENGINE_PLAN P5.5). */
export type TableShellColumn = {
  header: string;
  accessor: (row: unknown) => string;
  /** When true, column is omitted in compact display mode. */
  hideWhenCompact?: boolean;
  cellClass?: string;
};
