import { expect, test } from "@playwright/test";

import { seedThrowingPluginLayoutBeforeNavigation } from "./fixtures/editorGridFixture";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/dashboards/*/layout", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });
  await seedThrowingPluginLayoutBeforeNavigation(page);
});

test("throwing plugin tile shows error fallback and neighbours still render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-host")).toBeVisible();

  const throwingProbe = await page.evaluate(() =>
    Boolean((globalThis as unknown as { __KEA_FABRIC_E2E_THROWING?: boolean }).__KEA_FABRIC_E2E_THROWING),
  );
  expect(
    throwingProbe,
    "E2E throwing resolver not registered: use Playwright webServer defaults or start dev with VITE_E2E_THROWING=1 when PW_REUSE_DEV_SERVER=1.",
  ).toBe(true);

  const errorFallback = page.locator('[data-testid="tile-fallback"][data-fallback-reason="error"]');
  await expect(errorFallback.getByText("e2e.throwing")).toBeVisible();
  await expect(errorFallback.getByRole("heading", { name: "Tile error" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DHCP pools" })).toBeVisible();
});
