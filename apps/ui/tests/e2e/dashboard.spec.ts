import { expect, test } from "@playwright/test";

test("dashboard host renders tiles from mock API", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-host")).toBeVisible();
  await expect(page.getByText("perf.summary")).toBeVisible();
  await expect(page.getByText("dhcp.pools")).toBeVisible();
});

test("editor palette lists plugins from mock API", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  await expect(page.getByTestId("dashboard-editor")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add DHCP pools" })).toBeVisible();
});
