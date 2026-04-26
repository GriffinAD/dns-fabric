import { expect, test } from "@playwright/test";

import { seedNestedV3LayoutInLocalStorageBeforeNavigation } from "./fixtures/editorGridFixture";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/dashboards/*/layout", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });
  await seedNestedV3LayoutInLocalStorageBeforeNavigation(page);
});

test("dashboard read mode renders v3 nested groups and inner DHCP pools tile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-host")).toBeVisible();
  await expect(page.locator('[data-dashboard-nested-read="outer-e2e"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "DHCP pools" })).toBeVisible();
});
