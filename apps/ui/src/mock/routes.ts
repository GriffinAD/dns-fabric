/**
 * @deprecated Import base fixtures from ./fixtures; routing is handled in handleMockApi.
 * Kept for tests that snapshot route keys.
 */

import { baseFixtures } from "./fixtures";

export const mockRoutes: Record<string, unknown> = baseFixtures;
