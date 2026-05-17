import type { DataGateway } from "../../gateway/dataGateway";
import type { DashboardLayoutV3 } from "../types";

/** Immediate PUT of the current layout document (debounce lives in `layoutStore`). */
export async function flushLayoutToServer(
  gateway: DataGateway,
  dashboardId: string,
  layout: DashboardLayoutV3,
): Promise<void> {
  await gateway.putDashboardLayout(dashboardId, layout);
}

/** Live store + timestamped on-disk snapshot (see OpenAPI `postDashboardLayoutSaveFile`). */
export async function postLayoutSaveFileSnapshot(
  gateway: DataGateway,
  dashboardId: string,
  layout: DashboardLayoutV3,
): Promise<void> {
  await gateway.postDashboardLayoutSaveFile(dashboardId, layout);
}
