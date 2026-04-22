import { expect, test } from "@playwright/test";

test("home heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kea Fabric" })).toBeVisible();
});
