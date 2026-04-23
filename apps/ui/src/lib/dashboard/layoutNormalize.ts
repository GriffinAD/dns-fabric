import { layoutWithGrid } from "./gridPlacement";
import type { DashboardLayout, DashboardLayoutV2 } from "./types";
import { isLayoutV2 } from "./types";

export function normalizeLayoutStrict(
  next: DashboardLayout,
  editMode: boolean,
  opts?: { preserveRootPlacementIfComplete?: boolean },
): DashboardLayoutV2 {
  const normalized = layoutWithGrid(next, {
    preserveRootPlacementIfComplete: opts?.preserveRootPlacementIfComplete,
    editMode,
  });
  if (!isLayoutV2(normalized)) {
    throw new Error("Layout update was ignored (invalid structure).");
  }
  return normalized;
}
