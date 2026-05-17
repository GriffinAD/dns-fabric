import { expect, test } from "@playwright/test";

import { seedEditorLayoutInLocalStorageBeforeNavigation } from "./fixtures/editorGridFixture";

test.beforeEach(async ({ page }) => {
  /* Let `initialDashboardLayout()` use the seeded localStorage. Otherwise GET /layout returns
   * a persisted on-disk layout from the dev mock and overwrites the fixture. */
  await page.route("**/api/v1/dashboards/*/layout", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });
  await seedEditorLayoutInLocalStorageBeforeNavigation(page);
});

test("dashboard host renders tiles from mock API", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-host")).toBeVisible();
  await expect(page.getByRole("heading", { name: "CPU" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "RAM" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "DHCP pools" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DHCP clients" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Static reservations" })).toBeVisible();
  await expect(page.getByTestId("discovery-toolbar")).toBeVisible();
});

test("edit layout shows palette on the live dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const palette = page.getByTestId("layout-edit-palette").or(page.getByTestId("layout-edit-palette-v2"));
  await expect(palette).toBeVisible();
  await expect(page.getByRole("button", { name: "Add DHCP pools" })).toBeVisible();
});

test("discovery toolbar shows scan controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("discovery-toolbar")).toBeVisible();
  await expect(page.getByTestId("discovery-pause")).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText(/network scan/i);
});

test("admin page loads from hash route", async ({ page }) => {
  await page.goto("/#/admin");
  await expect(page.getByTestId("admin-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
});

test("admin UI Gauges settings page loads from hash route", async ({ page }) => {
  await page.goto("/#/admin/ui/gauges");
  await expect(page.getByTestId("admin-page")).toBeVisible();
  await expect(page.getByTestId("admin-ui-gauges-page")).toBeVisible();
  await expect(page.getByTestId("gauge-theme-controls")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gauge appearance" })).toBeVisible();
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

test("layout editor root grid enforces minimum row gap for between-row DnD hit testing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const rowGapPx = await page.getByTestId("editor-drop-zone").evaluate((el) => {
    return parseFloat(window.getComputedStyle(el).rowGap);
  });
  /* At least 0.75rem so the dragged ghost’s centre can sit between full-width root rows when
   * `--dashboard-gap` is 0 (svelte-dnd-action uses centre-based index resolution). */
  expect(rowGapPx).toBeGreaterThanOrEqual(11);
});

test("layout editor persists perf display style after leaving edit mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const ramTile = page
    .getByTestId("editor-drop-zone")
    .locator('[data-testid="editor-tile"][data-tile-id="tile-perf-ram"]');
  await ramTile.hover();
  await ramTile.getByTestId("tile-edit-button").click();
  await expect(page.getByTestId("tile-settings-overlay")).toBeVisible();
  await page.getByTestId("tile-settings-perf-display").selectOption("percent_only");
  await page.getByTestId("tile-settings-overlay").getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Return to dashboard" }).click();
  await expect(page.getByText(/^RAM:/)).toBeVisible();
});

test("tile settings parent: move tile from container to dashboard root", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-host")).toBeVisible();
  await page.getByRole("button", { name: "Edit layout", exact: true }).click();
  await expect(page.getByTestId("editor-drop-zone")).toBeVisible();
  const ramTile = page.locator('[data-testid="editor-tile"][data-tile-id="tile-perf-ram"]');
  await ramTile.hover();
  await ramTile.getByTestId("tile-edit-button").click();
  await expect(page.getByTestId("tile-settings-overlay")).toBeVisible();
  const parent = page.getByTestId("tile-settings-parent");
  await expect(parent).toBeVisible();
  await expect(parent).toHaveValue("group-status");
  await parent.selectOption("__dashboard__");
  await page.getByTestId("tile-settings-overlay").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("tile-settings-overlay")).not.toBeVisible();
  const raw = await page.evaluate(() => localStorage.getItem("kea-fabric-dashboard-layout"));
  expect(raw).toBeTruthy();
  const stored = JSON.parse(raw!) as { version: number; items: { kind: string; id: string; children?: { id: string }[]; pluginId?: string }[] };
  expect(stored.version).toBe(3);
  expect(stored.items.some((i) => i.kind === "tile" && i.id === "tile-perf-ram")).toBe(true);
  const groupStatus = stored.items.find((i) => i.kind === "group" && i.id === "group-status");
  expect(groupStatus?.children?.some((c) => c.id === "tile-perf-ram")).toBe(false);
});

test("layout editor lists tiles in layout order (DnD targets)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const zone = page.getByTestId("editor-drop-zone");
  const tiles = zone.getByTestId("editor-tile");
  await expect(tiles).toHaveCount(9);
  const expectedOrder = [
    "group-status",
    "tile-perf-cpu",
    "tile-perf-ram",
    "tile-perf-net",
    "tile-perf-disk",
    "tile-pools",
    "tile-discovery",
    "tile-clients",
    "tile-reservations",
  ];
  const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute("data-tile-id")));
  expect(ids).toEqual(expectedOrder);
});

test("editor pointer drag toggles chrome DnD active flag during reorder", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const chrome = page.getByTestId("editor-grid-chrome");
  await expect(chrome).toHaveAttribute("data-editor-pointer-dnd", "false");
  const zone = page.getByTestId("editor-drop-zone");
  const firstTile = zone.getByTestId("editor-tile").first();
  /* First item is often a container: hover near its top-left padding so inner plugins do not
   * suppress container chrome (see `app.css` :has(.editor-plugin-surface:hover)). */
  await firstTile.hover({ position: { x: 14, y: 14 } });
  const handle = firstTile.locator('[data-editor-container-chrome][data-testid="editor-container-drag-handle"]');
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2 + 6);
  await expect(chrome).toHaveAttribute("data-editor-pointer-dnd", "true", { timeout: 8000 });
  await page.mouse.up();
  await expect(chrome).toHaveAttribute("data-editor-pointer-dnd", "false", { timeout: 8000 });
});

test("edit layout: root grid tracks and ruler align", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const zone = page.getByTestId("editor-drop-zone");
  const err = await zone.evaluate((dropZone) => {
    const z = dropZone.getBoundingClientRect();
    const zCs = getComputedStyle(dropZone);
    // Drop-zone now has `padding-inline: var(--dashboard-gap)`; the 20 fr tracks occupy the
    // *content box* (clientWidth − paddingLeft − paddingRight), so use that for track math.
    const padLeft = parseFloat(zCs.paddingLeft) || 0;
    const padRight = parseFloat(zCs.paddingRight) || 0;
    const contentW = dropZone.clientWidth - padLeft - padRight;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const colGapRaw = parseFloat(zCs.columnGap);
    // Dashboard gap is user-configurable (0 by default). Without this guard, the old
    // `parseFloat("0px") || rem` truthy-check fell back to 16px when the gap is 0 and
    // invalidated every track/width expectation below.
    const colGap = Number.isFinite(colGapRaw) ? colGapRaw : rem;
    const gap = colGap;
    const trackCount = 20;
    const gapCount = trackCount - 1;
    const trackFromFr = (contentW - gapCount * gap) / trackCount;
    const contentLeft = z.left + padLeft;
    // Used by the old ruler "clientWidth" sanity check below.
    const w = contentW;
    const errors: string[] = [];
    const thresholdGrid = 1;
    const thresholdCard = 1.5;
    const thresholdRuler = 1.25; // CSS var used for background guides vs fr-track math

    function colPlacement(tile: HTMLElement): { col1: number; span: number } | null {
      const cs = getComputedStyle(tile);
      const start = cs.gridColumnStart;
      const end = cs.gridColumnEnd;
      const s1 = parseInt(start, 10);
      if (!Number.isFinite(s1) || s1 < 1) return null;
      const mSpan = /^span\s+(\d+)$/i.exec(end.trim());
      if (mSpan) {
        return { col1: s1, span: parseInt(mSpan[1]!, 10) };
      }
      const e1 = parseInt(end, 10);
      if (Number.isFinite(e1) && e1 > s1) {
        return { col1: s1, span: e1 - s1 };
      }
      return null;
    }

    function horizontalContentWidthNoScrollbar(el: HTMLElement): number {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width -
        parseFloat(s.borderLeftWidth) -
        parseFloat(s.borderRightWidth) -
        parseFloat(s.paddingLeft) -
        parseFloat(s.paddingRight)
      );
    }

    // How --d-track actually resolves for width (same as column guide backgrounds).
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;left:0;top:0;width:var(--d-track);height:0;pointer-events:none;visibility:hidden;box-sizing:border-box";
    dropZone.appendChild(probe);
    const trackVarPx = probe.getBoundingClientRect().width;
    dropZone.removeChild(probe);

    if (Math.abs(trackVarPx - trackFromFr) > thresholdRuler) {
      errors.push(
        `RULER vs ${trackCount}fr: var(--d-track) used width is ${trackVarPx.toFixed(2)}px but (clientWidth−${gapCount}*gap)/${trackCount} is ${trackFromFr.toFixed(2)}px — column guides and grid columns can look misaligned while tile math “passes”.`,
      );
    }

    // Closure: N equal tracks + (N−1) gaps = inner width
    if (Math.abs(trackCount * trackFromFr + gapCount * gap - w) > 1) {
      errors.push(
        `${trackCount}-track math: ${trackCount}*track+${gapCount}*gap=${(trackCount * trackFromFr + gapCount * gap).toFixed(2)} but clientWidth=${w} — formula/clientWidth mismatch.`,
      );
    }

    // Span-20 tile must fill the same width the fr columns sum to; catches shrink without contradicting dL/dR.
    const pools = dropZone.querySelector<HTMLElement>("[data-testid=\"editor-tile\"][data-tile-id=\"tile-pools\"]");
    if (pools) {
      const g = colPlacement(pools);
      if (g?.span === 20) {
        const impliedTrack = (pools.getBoundingClientRect().width - gapCount * gap) / trackCount;
        if (Math.abs(impliedTrack - trackFromFr) > thresholdRuler) {
          errors.push(
            `pools (span 20) implies track ${impliedTrack.toFixed(2)}px vs fr ${trackFromFr.toFixed(2)}px — full-width row not matching grid columns.`,
          );
        }
      }
    }

    const tiles = Array.from(dropZone.querySelectorAll<HTMLElement>(":scope > [data-testid=\"editor-tile\"]"));
    for (const tile of tiles) {
      const id = tile.getAttribute("data-tile-id") || "(missing data-tile-id)";
      const g = colPlacement(tile);
      if (!g) {
        errors.push(`${id}: could not read grid column from computed style`);
        continue;
      }
      const col0 = g.col1 - 1;
      const expectLeft = contentLeft + col0 * (trackFromFr + gap);
      const expectRight = expectLeft + g.span * trackFromFr + (g.span - 1) * gap;
      const r = tile.getBoundingClientRect();
      const dL = Math.abs(r.left - expectLeft);
      const dR = Math.abs(r.right - expectRight);
      if (dL > thresholdGrid) {
        errors.push(
          `${id}: left edge off by ${dL.toFixed(2)}px (expected from ${trackCount} fr tracks + gap)`,
        );
      }
      if (dR > thresholdGrid) {
        errors.push(
          `${id}: right edge off by ${dR.toFixed(2)}px (span ${g.span} tracks; min-width/overflow)`,
        );
      }
      // Explicit width check (tighter than dL/dR in edge cases)
      const expectW = g.span * trackFromFr + (g.span - 1) * gap;
      if (Math.abs(r.width - expectW) > thresholdGrid) {
        errors.push(
          `${id}: width ${r.width.toFixed(2)}px vs expected ${expectW.toFixed(2)}px (span ${g.span})`,
        );
      }
      const isGroupShell = tile.getAttribute("data-editor-group") === "true";
      if (isGroupShell) continue;

      const card = tile.querySelector<HTMLElement>("[data-scope=\"card\"][data-part=\"base\"]");
      if (!card) {
        errors.push(`${id}: no Flowbite card [data-scope=card][data-part=base] (cannot assert fill)`);
        continue;
      }
      const contentW = horizontalContentWidthNoScrollbar(tile);
      const cbr = card.getBoundingClientRect().width;
      const dCard = Math.abs(contentW - cbr);
      if (dCard > thresholdCard) {
        errors.push(
          `${id}: card width ${cbr.toFixed(2)}px vs tile content width ${contentW.toFixed(2)}px (delta ${dCard.toFixed(2)}px)`,
        );
      }
    }

    if (errors.length) {
      return { ok: false as const, errors, trackFromFr, trackVarPx, gap, w };
    }
    return { ok: true as const, nTiles: tiles.length, trackFromFr, trackVarPx, gap, w };
  });
  if (!err.ok) {
    throw new Error(
      "editor layout:\n" +
        err.errors.join("\n") +
        `\n(zone clientWidth ${err.w}px, fr track ${err.trackFromFr.toFixed(3)}px, var(--d-track) as width ${err.trackVarPx.toFixed(3)}px, gap ${err.gap}px)`,
    );
  }
  expect(err.nTiles).toBeGreaterThan(0);
  expect(
    Math.abs(err.trackVarPx - err.trackFromFr),
    "var(--d-track) and 20fr track must match (ruler vs engine)",
  ).toBeLessThanOrEqual(1.25);
});
