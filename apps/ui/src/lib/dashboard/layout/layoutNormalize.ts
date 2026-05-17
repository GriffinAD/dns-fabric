import { layoutWithGrid } from "../grid/gridPlacement";
import type { DashboardLayout, DashboardLayoutV3 } from "../types";
import { isLayoutV3 } from "../types";

export function normalizeLayoutStrict(
  next: DashboardLayout,
  editMode: boolean,
  opts?: { preserveRootPlacementIfComplete?: boolean },
): DashboardLayoutV3 {
  const normalized = layoutWithGrid(next, {
    preserveRootPlacementIfComplete: opts?.preserveRootPlacementIfComplete,
    editMode,
  });
  if (!isLayoutV3(normalized)) {
    throw new Error("Layout update was ignored (invalid structure).");
  }
  return normalized;
}
