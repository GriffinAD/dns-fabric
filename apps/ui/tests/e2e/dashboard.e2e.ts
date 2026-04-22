import { expect, test } from "@playwright/test";

test("dashboard host renders tiles from mock API", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-host")).toBeVisible();
  await expect(page.getByRole("heading", { name: "CPU" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "RAM" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DHCP pools" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DHCP clients" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Static reservations" })).toBeVisible();
  await expect(page.getByTestId("discovery-toolbar")).toBeVisible();
});

test("edit layout shows palette on the live dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  await expect(page.getByTestId("layout-edit-palette")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add DHCP pools" })).toBeVisible();
});

test("discovery toolbar shows scan controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("discovery-toolbar")).toBeVisible();
  await expect(page.getByTestId("discovery-pause")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/network scan/i);
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

test("layout editor drop zone reserves bottom padding for drag hit-testing past last row", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const paddingBottomPx = await page.getByTestId("editor-drop-zone").evaluate((el) => {
    return parseFloat(window.getComputedStyle(el).paddingBottom);
  });
  expect(paddingBottomPx).toBeGreaterThan(120);
});

test("layout editor persists perf display style after leaving edit mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  await page
    .locator('[data-testid="editor-tile"][data-tile-id="tile-perf-ram"]')
    .getByTestId("tile-edit-button")
    .click();
  await expect(page.getByTestId("tile-settings-overlay")).toBeVisible();
  await page.getByTestId("tile-settings-perf-display").selectOption("percent_only");
  await page.getByTestId("tile-settings-overlay").getByRole("button", { name: "Save" }).click();
  await page
    .getByLabel("Dashboard mode")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await expect(page.getByText(/^RAM:/)).toBeVisible();
});

test("layout editor lists tiles in layout order (DnD targets)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const zone = page.getByTestId("editor-drop-zone");
  const tiles = zone.getByTestId("editor-tile");
  await expect(tiles).toHaveCount(8);
  await expect(tiles.nth(0)).toHaveAttribute("data-tile-id", "tile-perf-cpu");
  await expect(tiles.nth(1)).toHaveAttribute("data-tile-id", "tile-perf-ram");
  await expect(tiles.nth(2)).toHaveAttribute("data-tile-id", "tile-perf-net");
  await expect(tiles.nth(3)).toHaveAttribute("data-tile-id", "tile-perf-disk");
  await expect(tiles.nth(4)).toHaveAttribute("data-tile-id", "tile-pools");
  await expect(tiles.nth(5)).toHaveAttribute("data-tile-id", "tile-discovery");
  await expect(tiles.nth(6)).toHaveAttribute("data-tile-id", "tile-clients");
  await expect(tiles.nth(7)).toHaveAttribute("data-tile-id", "tile-reservations");
});
