import { expect, test } from "@playwright/test";

import { seedTabGroupLayoutInLocalStorageBeforeNavigation } from "./fixtures/editorGridFixture";
import { simulateSveltedndDrop } from "./fixtures/sveltedndDrop";

test.beforeEach(async ({ page }) => {
  /* Keep `initialDashboardLayout()` on the tab fixture; block mock GET /layout overwrite. */
  await page.route("**/api/v1/dashboards/*/layout", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });
  await seedTabGroupLayoutInLocalStorageBeforeNavigation(page);
});

test("palette drop on tab pane empty adds a tile inside the tab container", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  await expect(page.getByTestId("tab-group-host")).toBeVisible();
  const pane = page.getByTestId("tab-group-pane");
  await expect(pane.getByTestId("editor-group-nowrap-empty")).toBeVisible();
  await simulateSveltedndDrop(
    page,
    '.inline-flex[data-palette-drag-plugin-id="dhcp.reservations"]',
    '[data-palette-drag-plugin-id="dhcp.reservations"] [data-testid="palette-chip-drag"]',
    '[data-testid="editor-group-nowrap-empty"]',
    { k: "pp", i: "dhcp.reservations" },
  );
  await expect(pane.getByRole("heading", { name: "Static reservations" })).toBeVisible({
    timeout: 8000,
  });
  const raw = await page.evaluate(() => localStorage.getItem("kea-fabric-dashboard-layout"));
  expect(raw).toBeTruthy();
  const stored = JSON.parse(raw!) as {
    version: number;
    items: { kind: string; id: string; hostControl?: string; children?: { kind?: string; children?: { pluginId?: string }[] }[] }[];
  };
  const tabsGroup = stored.items.find((i) => i.kind === "group" && i.id === "tabs-e2e");
  const paneGroup = tabsGroup?.children?.[0];
  expect(paneGroup && "children" in paneGroup && paneGroup.children?.some((c) => c.pluginId === "dhcp.reservations")).toBe(
    true,
  );
});

test("palette drop on tab strip adds a tab", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  await expect(page.getByTestId("tab-group-host")).toBeVisible();
  const strip = page.getByTestId("tab-group-strip");
  await expect(strip).toBeVisible();
  const tabsBefore = await strip.getByTestId("tab-strip-item").count();
  await simulateSveltedndDrop(
    page,
    '.inline-flex[data-palette-drag-plugin-id="dhcp.reservations"]',
    '[data-palette-drag-plugin-id="dhcp.reservations"] [data-testid="palette-chip-drag"]',
    '[data-dnd-container="g:tabs-e2e:tabs"]',
    { k: "pp", i: "dhcp.reservations" },
  );
  await expect(strip.getByTestId("tab-strip-item")).toHaveCount(tabsBefore + 1, { timeout: 8000 });
  await expect(strip.getByTestId("tab-strip-label").filter({ hasText: "Static reservations" })).toBeVisible();
  const raw = await page.evaluate(() => localStorage.getItem("kea-fabric-dashboard-layout"));
  expect(raw).toBeTruthy();
  const stored = JSON.parse(raw!) as {
    version: number;
    items: {
      kind: string;
      id: string;
      hostControl?: string;
      children?: Array<
        | { pluginId?: string; tabLabel?: string }
        | { tabLabel?: string; children?: Array<{ pluginId?: string }> }
      >;
    }[];
  };
  const tabsGroup = stored.items.find((i) => i.kind === "group" && i.id === "tabs-e2e");
  expect(tabsGroup?.hostControl).toBe("tab-control");
  expect(
    tabsGroup?.children?.some((c) => {
      if ("tabLabel" in c && c.tabLabel === "Static reservations") return true;
      return "pluginId" in c && c.pluginId === "dhcp.reservations";
    }),
  ).toBe(true);
});
