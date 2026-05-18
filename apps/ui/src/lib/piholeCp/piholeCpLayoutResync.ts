export function shouldApplyCpLayoutResync(opts: {
  layoutResyncEpoch: number;
  editorOpen: boolean;
  forceAfterEnvApply: boolean;
}): boolean {
  if (opts.layoutResyncEpoch > 0) return true;
  if (opts.forceAfterEnvApply) return true;
  return false;
}

export function shouldMergeServerWidgets(editorOpen: boolean): boolean {
  return !editorOpen;
}
