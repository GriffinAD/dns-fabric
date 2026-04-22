import { expect, test } from "@playwright/test";

test("dashboard host renders tiles from mock API", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-host")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Performance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DHCP pools" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discovery records" })).toBeVisible();
});

test("editor palette lists plugins from mock API", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  await expect(page.getByTestId("dashboard-editor")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add DHCP pools" })).toBeVisible();
});

test("discovery toolbar shows scan controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("discovery-toolbar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("admin page loads from hash route", async ({ page }) => {
  await page.goto("/#/admin");
  await expect(page.getByTestId("admin-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
});

test("layout editor supports native drop zone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  await expect(page.getByTestId("editor-drop-zone")).toBeVisible();
});

test("layout editor lists tiles in layout order (DnD targets)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const zone = page.getByTestId("editor-drop-zone");
  const tiles = zone.getByTestId("editor-tile");
  await expect(tiles).toHaveCount(3);
  // Matches DEFAULT_DASHBOARD_LAYOUT: perf, pools, discovery.
  await expect(tiles.nth(0)).toHaveAttribute("data-tile-id", "tile-perf");
  await expect(tiles.nth(1)).toHaveAttribute("data-tile-id", "tile-pools");
  await expect(tiles.nth(2)).toHaveAttribute("data-tile-id", "tile-discovery");
  await expect(tiles.first()).toHaveAttribute("role", "listitem");
});
