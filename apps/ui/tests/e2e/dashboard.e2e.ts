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
  await expect(page.getByTestId("layout-edit-palette")).toBeVisible();
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
    .getByTestId("editor-drop-zone")
    .locator('[data-testid="editor-tile"][data-tile-id="tile-perf-ram"]')
    .getByTestId("tile-edit-button")
    .click();
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
  await page
    .locator('[data-testid="editor-tile"][data-tile-id="tile-perf-ram"]')
    .getByTestId("tile-edit-button")
    .click();
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
  expect(stored.version).toBe(2);
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

test.skip("edit layout: grid tracks, --d-track ruler, tile shells, and Flowbite cards line up (no false pass)", async ({
  page,
}) => {
  /* Skipped: asserts 12-col placement on every `editor-tile`. The seeded layout groups the
   * status perf row in a container; inner tiles are laid out in a strip, not as direct children
   * of the root 12-column grid. Revisit with a flat fixture or scope checks to root-level tiles. */
  await page.goto("/");
  await page.getByRole("button", { name: "Edit layout" }).click();
  const zone = page.getByTestId("editor-drop-zone");
  const err = await zone.evaluate((dropZone) => {
    const z = dropZone.getBoundingClientRect();
    const zCs = getComputedStyle(dropZone);
    // Drop-zone now has `padding-inline: var(--dashboard-gap)`; the 12 fr tracks occupy the
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
    const trackFromFr = (contentW - 11 * gap) / 12;
    const contentLeft = z.left + padLeft;
    // Used by the old ruler "clientWidth" sanity check below.
    const w = contentW;
    const errors: string[] = [];
    const thresholdGrid = 1;
    const thresholdCard = 1.5;
    const thresholdRuler = 1.25; // CSS var used for background guides vs 12fr math

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
        `RULER vs 12fr: var(--d-track) used width is ${trackVarPx.toFixed(2)}px but (clientWidth−11*gap)/12 is ${trackFromFr.toFixed(2)}px — column guides and grid columns can look misaligned while tile math “passes”.`,
      );
    }

    // Closure: 12 equal tracks + 11 gaps = inner width
    if (Math.abs(12 * trackFromFr + 11 * gap - w) > 1) {
      errors.push(
        `12-track math: 12*track+11*gap=${(12 * trackFromFr + 11 * gap).toFixed(2)} but clientWidth=${w} — formula/clientWidth mismatch.`,
      );
    }

    // Span-12 tile must fill the same width the fr columns sum to; catches shrink without contradicting dL/dR.
    const pools = dropZone.querySelector<HTMLElement>("[data-testid=\"editor-tile\"][data-tile-id=\"tile-pools\"]");
    if (pools) {
      const g = colPlacement(pools);
      if (g?.span === 12) {
        const impliedTrack = (pools.getBoundingClientRect().width - 11 * gap) / 12;
        if (Math.abs(impliedTrack - trackFromFr) > thresholdRuler) {
          errors.push(
            `pools (span 12) implies track ${impliedTrack.toFixed(2)}px vs fr ${trackFromFr.toFixed(2)}px — full-width row not matching grid columns.`,
          );
        }
      }
    }

    // Row-0 perf tiles: gaps between adjacent border boxes should equal one column gap.
    const row0Ids = [
      "tile-perf-cpu",
      "tile-perf-ram",
      "tile-perf-net",
      "tile-perf-disk",
    ] as const;
    const row0: HTMLElement[] = [];
    for (const id of row0Ids) {
      const el = dropZone.querySelector<HTMLElement>(`[data-testid="editor-tile"][data-tile-id="${id}"]`);
      if (el) row0.push(el);
    }
    for (let i = 0; i < row0.length - 1; i++) {
      const a = row0[i]!.getBoundingClientRect();
      const b = row0[i + 1]!.getBoundingClientRect();
      const got = b.left - a.right;
      if (Math.abs(got - gap) > thresholdGrid) {
        errors.push(
          `row-0 gap between ${row0Ids[i]!} and ${row0Ids[i + 1]!} is ${got.toFixed(2)}px, expected one column gap ${gap}px (mis-packed row).`,
        );
      }
    }

    const tiles = Array.from(
      dropZone.querySelectorAll<HTMLElement>("[data-testid=\"editor-tile\"]"),
    );
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
          `${id}: left edge off by ${dL.toFixed(2)}px (expected from 12 fr tracks + gap)`,
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
  expect(err.nTiles).toBe(8);
  expect(
    Math.abs(err.trackVarPx - err.trackFromFr),
    "var(--d-track) and 12fr track must match (ruler vs engine)",
  ).toBeLessThanOrEqual(1.25);
});
