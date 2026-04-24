/** Column model for `TablePluginShell.svelte` (`docs/planning/UI_ENGINE_PLAN.md` P5.5). */
export type TableShellColumn = {
  header: string;
  accessor: (row: unknown) => string;
  /** When true, column is omitted in compact display mode. */
  hideWhenCompact?: boolean;
  cellClass?: string;
};
