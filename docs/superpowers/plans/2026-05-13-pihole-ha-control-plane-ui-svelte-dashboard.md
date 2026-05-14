# Pi-hole HA control plane — Svelte drag-and-drop operator dashboard (reuse `apps/ui`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an **operator dashboard UI** for the **`pihole-ha`** control plane that **reuses the same drag-and-drop stack** as Kea Fabric (`svelte-dnd-action`, 20-column grid contracts, editor DOM attributes) documented in **`docs/architecture/dashboard-plugin-blueprint.md`**, while **reading** the Pi-hole JSON API (`GET /dashboard`, `GET /logs/catalog`, SSE) instead of the Kea **`DataGateway`** OpenAPI surface.

**Architecture:** This work is implemented **in this repository** under **`apps/ui/`** — that is the **intended starting point** named in the normative design (`docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §2.2, §5.4): **rich UI here**, **API + probes in `pihole-ha`**. Add a **second Vite entry** that mounts **`PiholeOperatorApp`**. Layout persistence starts as **`localStorage`** when the bundle is served same-origin from the control-plane container; optional later **`POST`** persistence waits for **Phase 3** auth/audit. **Do not** import **`DataGateway`** for Pi-hole data — it is bound to **`openapiZod`** types for Kea Fabric; use a **`PiholeCpGateway`** with a **dedicated Zod** schema for **`/dashboard`**.

**Deployment:** After `vite build`, the **`dist/`** output is **copied or multi-stage-built** into **`pihole-ha`** `platform/control-plane/` static assets (see plan Task 6) so §3.1 “one process, one port” remains true on the node.

**Tech stack:** Svelte 5, `svelte-dnd-action`, Vite multi-page build, Zod, Vitest, Tailwind (existing **`apps/ui`** pipeline).

**Normative inputs:**

- Pi-hole API + widgets: `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §5.1–§5.2
- DnD + grid rules: `docs/architecture/dashboard-plugin-blueprint.md` (§ “Layout editor v3 and drag/drop split”)
- Reference implementation: `apps/ui/src/lib/dashboard/DashboardHost.svelte`, `DashboardEditRootGrid.svelte`, `gridPlacement.ts`

**Relationship to `2026-05-13-pihole-ha-control-plane-ui.md`:** Bootstrap **Tasks 2–5** already shipped **`dashboard.html`** (static JSON viewer) on **`pihole-ha`** **`main`**. This plan **adds** the rich Svelte UI **without removing** the static shell until the new bundle is vetted.

## Why `pi-fabric` / `dns-fabric` first (design intent)

The normative spec **explicitly** names **`pi-fabric`** as the place where the **dashboard shell and UI engineering patterns** live (§2.2, §5.4). The earlier phase plans focused on **`pihole-ha`** because they tracked **§7 Phase 1–4** items that are mostly **API / compose / ops**; that was **not** a downgrade of this repo — it separated **runtime on the Pi** from **UI source of truth here**. This file is the **implementation plan for the “good starting point” UI**; treat **`apps/ui`** as the default working tree until an ADR moves shared code to a package.

---

## File map (repo: `pi-fabric` / `dns-fabric` unless noted)

| Path | Responsibility |
|------|----------------|
| `apps/ui/index-pihole-cp.html` | Second HTML entry mounting the Pi-hole operator app |
| `apps/ui/src/piholeCp-entry.ts` | Vite entry: `mount(PiholeOperatorApp, target)` |
| `apps/ui/src/lib/piholeCp/dashboardZod.ts` | Zod schema for **`GET /dashboard`** (+ small helpers) |
| `apps/ui/src/lib/piholeCp/PiholeCpGateway.ts` | `fetch` + Zod parse + typed errors (mirror `GatewayError` shape) |
| `apps/ui/src/lib/piholeCp/PiholeOperatorApp.svelte` | Shell: node banner, peer link from **`/v1/meta`**, refresh button |
| `apps/ui/src/lib/piholeCp/PiholeLayoutGrid.svelte` | **Read/edit** grid using **`dragHandleZone`** for **widget tiles** only (reuse patterns from `DashboardEditRootGrid.svelte`, not the full plugin palette) |
| `apps/ui/src/lib/piholeCp/SectionJsonTile.svelte` | Renders one **`widgets[]`** entry → bound **`sections[section]`** as pretty JSON |
| `apps/ui/src/lib/piholeCp/LogStreamPanel.svelte` | `EventSource` to **`/logs/stream/{id}`** (catalogue dropdown) |
| `apps/ui/vite.config.ts` | Multi-page **`input`** for `main` + `piholeCp` |
| `apps/ui/src/lib/piholeCp/PiholeCpGateway.test.ts` | Vitest: mock `fetch`, schema pass/fail |
| `pihole-ha/platform/control-plane/Dockerfile` | Optional multi-stage: **COPY** `apps/ui/dist/piholeCp/...` into image **`static/`** |

---

### Task 1: Zod contract for `GET /dashboard`

**Files:**

- Create: `apps/ui/src/lib/piholeCp/dashboardZod.ts`
- Create: `apps/ui/src/lib/piholeCp/PiholeCpGateway.test.ts`

- [ ] **Step 1: Write failing Vitest (schema rejects unknown)**

Create `apps/ui/src/lib/piholeCp/PiholeCpGateway.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { dashboardResponseSchema } from "./dashboardZod";

describe("dashboardResponseSchema", () => {
  it("accepts minimal dashboard payload", () => {
    const parsed = dashboardResponseSchema.parse({
      node: "pi2",
      version: "0.4.0",
      widgets: [{ id: "ha_summary", title: "HA", section: "ha" }],
      sections: { ha: { ok: true } },
    });
    expect(parsed.node).toBe("pi2");
  });
});
```

- [ ] **Step 2: Run Vitest (expect FAIL: module not found)**

```bash
cd /Volumes/Data/piHole/pi-fabric/apps/ui
npm run check:ui-unit -- --run src/lib/piholeCp/PiholeCpGateway.test.ts
```

Expected: **FAIL** — cannot resolve `./dashboardZod`.

- [ ] **Step 3: Add `dashboardZod.ts`**

Create `apps/ui/src/lib/piholeCp/dashboardZod.ts`:

```typescript
import { z } from "zod";

const widgetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  section: z.string().min(1),
});

export const dashboardResponseSchema = z.object({
  node: z.string(),
  version: z.string(),
  widgets: z.array(widgetSchema),
  sections: z.record(z.string(), z.unknown()),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
```

- [ ] **Step 4: Re-run Vitest**

```bash
npm run check:ui-unit -- --run src/lib/piholeCp/PiholeCpGateway.test.ts
```

Expected: **PASS**.

- [ ] **Step 5: Commit (`pi-fabric`)**

```bash
git add apps/ui/src/lib/piholeCp/dashboardZod.ts apps/ui/src/lib/piholeCp/PiholeCpGateway.test.ts
git commit -s -m "feat(ui-pihole-cp): zod schema for control plane dashboard JSON"
```

---

### Task 2: `PiholeCpGateway` (fetch + parse)

**Files:**

- Create: `apps/ui/src/lib/piholeCp/PiholeCpGateway.ts`
- Modify: `apps/ui/src/lib/piholeCp/PiholeCpGateway.test.ts`

- [ ] **Step 1: Extend test with `global.fetch` mock**

Append to `PiholeCpGateway.test.ts`:

```typescript
import { afterEach, vi } from "vitest";

import { PiholeCpGateway } from "./PiholeCpGateway";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PiholeCpGateway", () => {
  it("loads dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          node: "pi2",
          version: "0.4.0",
          widgets: [{ id: "ha_summary", title: "HA", section: "ha" }],
          sections: { ha: { ok: true } },
        }),
      })),
    );
    const gw = new PiholeCpGateway("");
    const dash = await gw.getDashboard();
    expect(dash.node).toBe("pi2");
  });
});
```

- [ ] **Step 2: Run Vitest (FAIL: class missing)**

```bash
npm run check:ui-unit -- --run src/lib/piholeCp/PiholeCpGateway.test.ts
```

Expected: **FAIL** — `PiholeCpGateway` not defined.

- [ ] **Step 3: Implement gateway**

Create `apps/ui/src/lib/piholeCp/PiholeCpGateway.ts`:

```typescript
import { dashboardResponseSchema, type DashboardResponse } from "./dashboardZod";

export class PiholeCpGateway {
  constructor(private readonly baseUrl: string) {}

  private url(path: string): string {
    const b = this.baseUrl.replace(/\/$/, "");
    return `${b}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async getDashboard(): Promise<DashboardResponse> {
    const res = await fetch(this.url("/dashboard"), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`dashboard_http_${res.status}`);
    const body: unknown = await res.json();
    return dashboardResponseSchema.parse(body);
  }

  async getMeta(): Promise<{ peer_ui_base_url: string | null; node: string }> {
    const res = await fetch(this.url("/v1/meta"), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`meta_http_${res.status}`);
    const body = (await res.json()) as { peer_ui_base_url?: string | null; node?: string };
    return { peer_ui_base_url: body.peer_ui_base_url ?? null, node: body.node ?? "unknown" };
  }
}
```

- [ ] **Step 4: Vitest PASS + commit**

```bash
npm run check:ui-unit -- --run src/lib/piholeCp/PiholeCpGateway.test.ts
git add apps/ui/src/lib/piholeCp/PiholeCpGateway.ts apps/ui/src/lib/piholeCp/PiholeCpGateway.test.ts
git commit -s -m "feat(ui-pihole-cp): gateway for dashboard and meta"
```

---

### Task 3: Vite second entry (`index-pihole-cp.html`)

**Files:**

- Create: `apps/ui/index-pihole-cp.html`
- Create: `apps/ui/src/piholeCp-entry.ts`
- Modify: `apps/ui/vite.config.ts`

- [ ] **Step 1: Add HTML shell**

Create `apps/ui/index-pihole-cp.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pi-hole HA — operator dashboard</title>
  </head>
  <body class="bg-slate-50 text-slate-900 dark:bg-gray-950 dark:text-gray-100">
    <div id="pihole-cp-app"></div>
    <script type="module" src="/src/piholeCp-entry.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Add entry module**

Create `apps/ui/src/piholeCp-entry.ts`:

```typescript
import { mount } from "svelte";

import PiholeOperatorApp from "./lib/piholeCp/PiholeOperatorApp.svelte";

const target = document.getElementById("pihole-cp-app");
if (!target) throw new Error("missing #pihole-cp-app");
mount(PiholeOperatorApp, { target });
```

- [ ] **Step 3: Extend Vite config `build.rollupOptions.input`**

In `apps/ui/vite.config.ts`, inside `export default defineConfig({`, add:

```typescript
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
        piholeCp: "./index-pihole-cp.html",
      },
    },
  },
```

Paths are relative to **`apps/ui/`** (where `vite.config.ts` lives).

- [ ] **Step 4: Build and confirm output**

```bash
cd /Volumes/Data/piHole/pi-fabric/apps/ui
npm ci
npm run build
```

Expected: `dist/index-pihole-cp.html` exists alongside `dist/index.html`.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/index-pihole-cp.html apps/ui/src/piholeCp-entry.ts apps/ui/vite.config.ts
git commit -s -m "build(ui): add Pi-hole control plane Vite entry"
```

---

### Task 4: `PiholeOperatorApp` + `SectionJsonTile` + DnD grid shell

**Files:**

- Create: `apps/ui/src/lib/piholeCp/PiholeOperatorApp.svelte`
- Create: `apps/ui/src/lib/piholeCp/SectionJsonTile.svelte`
- Create: `apps/ui/src/lib/piholeCp/PiholeLayoutGrid.svelte`

- [ ] **Step 1: Minimal tile + app (no DnD yet)**

`SectionJsonTile.svelte`:

```svelte
<script lang="ts">
  let { title, payload }: { title: string; payload: unknown } = $props();
</script>

<section class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
  <h2 class="mb-2 text-sm font-semibold">{title}</h2>
  <pre class="max-h-64 overflow-auto text-xs">{JSON.stringify(payload, null, 2)}</pre>
</section>
```

`PiholeOperatorApp.svelte` (load on mount; `baseUrl` from `import.meta.env.VITE_PIHOLE_CP_BASE_URL ?? ""`):

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  import { PiholeCpGateway } from "./PiholeCpGateway";
  import PiholeLayoutGrid from "./PiholeLayoutGrid.svelte";

  let error = $state<string | null>(null);
  let dashboard = $state<import("./dashboardZod").DashboardResponse | null>(null);

  onMount(async () => {
    const base = import.meta.env.VITE_PIHOLE_CP_BASE_URL ?? "";
    const gw = new PiholeCpGateway(typeof base === "string" ? base : "");
    try {
      dashboard = await gw.getDashboard();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });
</script>

{#if error}
  <p class="p-4 text-red-600">{error}</p>
{:else if !dashboard}
  <p class="p-4">Loading…</p>
{:else}
  <PiholeLayoutGrid {dashboard} />
{/if}
```

- [ ] **Step 2: `PiholeLayoutGrid` with `svelte-dnd-action`**

In `PiholeLayoutGrid.svelte`, copy the **import pattern** from `DashboardEditRootGrid.svelte` lines 119–128 (`use:dragHandleZone`, `onconsider`, `onfinalize`, `SOURCES.POINTER` handling optional). Use **`items`** shaped as `{ id: string; widgetId: string }[]` initialised from **`dashboard.widgets`**. On finalize, persist order to **`localStorage`** key **`pihole-cp.widget-order.v1`**.

Minimum `dragHandleZone` block:

```svelte
<script lang="ts">
  import { dragHandleZone } from "svelte-dnd-action";
  import type { DashboardResponse } from "./dashboardZod";
  import SectionJsonTile from "./SectionJsonTile.svelte";

  let { dashboard }: { dashboard: DashboardResponse } = $props();

  type Row = { id: string; widgetId: string };
  let items = $state<Row[]>([]);

  $effect(() => {
    items = dashboard.widgets.map((w) => ({ id: w.id, widgetId: w.id }));
  });

  function handleConsider(e: CustomEvent<{ items: Row[] }>) {
    items = e.detail.items;
  }
  function handleFinalize(e: CustomEvent<{ items: Row[] }>) {
    items = e.detail.items;
    localStorage.setItem("pihole-cp.widget-order.v1", JSON.stringify(items.map((i) => i.widgetId)));
  }
</script>

<div
  class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3"
  use:dragHandleZone={{ items, flipDurationMs: 150, type: "pihole-cp-widgets" }}
  onconsider={handleConsider}
  onfinalize={handleFinalize}
>
  {#each items as it (it.id)}
    {@const w = dashboard.widgets.find((x) => x.id === it.widgetId)}
    {#if w}
      <SectionJsonTile title={w.title} payload={dashboard.sections[w.section]} />
    {/if}
  {/each}
</div>
```

- [ ] **Step 3: Run `npm run build` + `npm run check:ui-unit`**

Expected: **PASS** (add Vitest for `PiholeLayoutGrid` only if you extract pure reorder helpers; optional in first slice).

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/lib/piholeCp/PiholeOperatorApp.svelte apps/ui/src/lib/piholeCp/SectionJsonTile.svelte apps/ui/src/lib/piholeCp/PiholeLayoutGrid.svelte
git commit -s -m "feat(ui-pihole-cp): operator shell with DnD widget grid"
```

---

### Task 5: Log panel + dev proxy env

**Files:**

- Create: `apps/ui/src/lib/piholeCp/LogStreamPanel.svelte`
- Modify: `apps/ui/vite.config.ts` (optional second `proxy` for `/logs` → control plane)
- Modify: `docs/operations/control-plane-ui.md` (**pihole-ha** repo) — link to **`pi-fabric`** build instructions

- [ ] **Step 1: `LogStreamPanel.svelte`**

Implement: `fetch("/logs/catalog")` → populate `<select>`; `Start` opens **`EventSource("/logs/stream/" + id)`**; append lines to `<pre>` (mirror `dashboard.html` behaviour).

- [ ] **Step 2: Embed in `PiholeOperatorApp.svelte` below grid**

- [ ] **Step 3: Document `VITE_PIHOLE_CP_BASE_URL`**

In **`pihole-ha`** `docs/operations/control-plane-ui.md`, add subsection **Svelte dashboard (pi-fabric)** with:

```bash
cd /path/to/pi-fabric/apps/ui
VITE_PIHOLE_CP_BASE_URL=http://192.0.2.4:8091 npm run dev -- --port 5174
```

- [ ] **Step 4: Commit both repos** (two commits).

---

### Task 6 (optional): Ship bundle inside `pihole-ha` image

**Files:**

- Modify: `pihole-ha/platform/control-plane/Dockerfile`
- Modify: `pihole-ha/platform/control-plane/app/static/` (copy `dist/assets` + `index-pihole-cp.html` renamed to `svelte/index.html` or serve root)

- [ ] **Step 1: Multi-stage Dockerfile `AS ui`** running `npm ci && npm run build` from **`apps/ui`** build context (requires build context **`../..`** from `pihole-ha` if monorepo checkout includes **`pi-fabric`** — **only viable in combined workspaces**; otherwise publish **`ghcr.io/.../pihole-cp-ui:tag`** and `COPY --from=`).

- [ ] **Step 2: FastAPI route `GET /next/`** mounting the built static subfolder (or serve via `StaticFiles` subdirectory).

This task is **optional** until you pick **monorepo build** vs **prebuilt image**; document the choice in **`dns-fabric`** ADR if it affects release.

---

## Self-review

| Design § | Task |
|----------|------|
| §5.1 widget registry | `widgets[]` drives DnD items |
| §5.1 logs dropdown | Task 5 |
| §5.4 repo split | Implementation in **`pi-fabric`** `apps/ui`; **`pihole-ha`** stays API-first |
| Blueprint DnD split | Reuse **`dragHandleZone`**; palette→grid HTML5 **out of scope** for first slice |

**Gap (explicit):** Full **20-column** `data-dashboard-editor` chrome from **`DashboardHost.svelte`** is **not** required for v1; this plan uses a **simple responsive CSS grid** first. Promote to full grid when layouts need persistence server-side.

---

**Plan complete and saved to** `docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-ui-svelte-dashboard.md`.

**Execution options:**

1. **Subagent-driven (recommended)** — one subagent per Task.
2. **Inline execution** — run Tasks 1–5 in order in this session.

Which approach?
