import type { RootLayoutItem } from "./types";

/** Exported for tests and any future explicit sort of root `items`. */
export function compareRootItemsByPosition(a: RootLayoutItem, b: RootLayoutItem): number {
  const g = (it: RootLayoutItem) => {
    if (it.kind === "group") {
      const o = it.grid;
      return { row: o?.row ?? 0, col: o?.col ?? 0 };
    }
    return { row: it.grid?.row ?? 0, col: it.grid?.col ?? 0 };
  };
  const pa = g(a);
  const pb = g(b);
  return pa.row - pb.row || pa.col - pb.col;
}
