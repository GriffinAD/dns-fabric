import { expect, test, type Page } from "@playwright/test";

import { seedEditorLayoutInLocalStorageBeforeNavigation } from "./fixtures/editorGridFixture";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/dashboards/*/layout", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });
  await seedEditorLayoutInLocalStorageBeforeNavigation(page);
});

/** Leaf tiles only (exclude container chrome with `data-editor-group`). */
async function leafTileOrderByPosition(page: Page, edit: boolean): Promise<string[]> {
  const scope = edit ? '[data-testid="editor-drop-zone"]' : '[data-dashboard-tile-grid]';
  return page.locator(`${scope} [data-tile-id]:not([data-editor-group="true"])`).evaluateAll((els) =>
    [...els]
      .map((e) => ({
        id: e.getAttribute("data-tile-id")!,
        top: e.getBoundingClientRect().top,
        left: e.getBoundingClientRect().left,
      }))
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .map((o) => o.id),
  );
}

test("read and edit mode share leaf tile visual order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-host")).toBeVisible();
  const readOrder = await leafTileOrderByPosition(page, false);
  expect(readOrder.length).toBeGreaterThan(3);

  await page.getByRole("button", { name: "Edit layout" }).click();
  await expect(page.getByTestId("editor-drop-zone")).toBeVisible();
  const editOrder = await leafTileOrderByPosition(page, true);

  expect(editOrder).toEqual(readOrder);
});
