import type { DataGateway } from "../../dataGateway";
import type { DashboardLayoutV2 } from "../types";

/** Immediate PUT of the current layout document (debounce lives in `layoutStore`). */
export async function flushLayoutToServer(
  gateway: DataGateway,
  dashboardId: string,
  layout: DashboardLayoutV2,
): Promise<void> {
  await gateway.putDashboardLayout(dashboardId, layout);
}

/** Live store + timestamped on-disk snapshot (see OpenAPI `postDashboardLayoutSaveFile`). */
export async function postLayoutSaveFileSnapshot(
  gateway: DataGateway,
  dashboardId: string,
  layout: DashboardLayoutV2,
): Promise<void> {
  await gateway.postDashboardLayoutSaveFile(dashboardId, layout);
}
