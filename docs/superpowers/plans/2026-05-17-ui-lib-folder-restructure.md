# UI `src/lib` folder restructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `apps/ui/src/lib/` into logical subfolders so `components/`, `piholeCp/`, `plugins/`, and the lib root are navigable without long flat file lists — **zero behaviour change**, imports and coverage paths updated only.

**Architecture:** Purely mechanical moves (`git mv`) grouped by domain (table, gauge, DHCP tiles, CP gateway, app shell). No new barrels unless a task explicitly adds a one-line re-export shim for a high-churn public path. Prefer updating import paths over indirection. Run `npm --prefix apps/ui run check:ui-unit` and `check:ui-e2e` after each phase commit.

**Tech Stack:** Svelte 5, Vitest (100% line coverage on `src/lib/**/*.ts` + selected `.svelte`), Vite coverage excludes, `scripts/check_ui_plugin_guard.sh`.

**Relationship to other work:** [`2026-05-17-ui-refactor-separation-of-concerns.md`](2026-05-17-ui-refactor-separation-of-concerns.md) refactors **behaviour and size** (`placement/`, `FabricEventBus`, tabs). This plan refactors **folder hygiene** only. Use branch `refactor/ui-lib-folders` rebased on current `main`. If both branches touch the same file, **finish or merge folder restructure first**, then continue R6+ on the refactor branch (fewer merge conflicts).

**Prerequisites:** [`docs/architecture/ui-component-and-service-map.md`](../architecture/ui-component-and-service-map.md). Green `npm --prefix apps/ui run check:ui-unit` before Task 0.

**Worktree:** `git fetch origin && git checkout -b refactor/ui-lib-folders origin/main`

---

## Current pain (inventory)

| Path | Flat files (approx.) | Notes |
| --- | ---: | --- |
| `lib/components/` | 36 | Table, gauge, validation, editors mixed |
| `lib/piholeCp/` | 43 | Shell, gateway, perf poll, layout, env, logs |
| `lib/plugins/` | 17 + `perf/` | DHCP/discovery tiles beside registry/bus |
| `lib/` root | 10 | App shell + `dataGateway` + `uiVersion` + `mockRoutes.test.ts` |
| `lib/dashboard/` root | 70 | Already has `placement/`, `editor/`, … — **optional Phase 5** |

External importers (must update when targets move):

- **Components:** `lib/plugins/*Tile.svelte` (7), `lib/admin/Admin*.svelte` (2)
- **Plugins:** `lib/dashboard/*`, `lib/palette/*`, `lib/platform/extensions/dashboardTileRegistry.ts`, `lib/operatorBoot.test.ts`, `lib/piholeCp/PiholeCpDashboardShell.svelte`
- **piholeCp:** `src/piholeCp-entry.ts`, `lib/dashboard/layoutStore.ts`, `lib/dashboard/transports/cpFabricTransport.ts`
- **lib root:** `src/App.svelte`, `src/main.ts`, many `lib/**` relatives

---

## Target tree (end state)

```
apps/ui/src/lib/
  app/                          # operator shell wiring (from lib root)
    appDashboardShell.ts
    appDashboardShell.test.ts
    appMount.ts
    appMount.test.ts
    operatorBoot.ts
    operatorBoot.test.ts
  gateway/
    dataGateway.ts
    dataGateway.test.ts
  version/
    uiVersion.ts
    uiVersion.test.ts
  api/
    openapiZod.ts
    openapiZod.test.ts
    types.ts
    mockRoutes.test.ts          # moved from lib root
  components/
    baseDataTable/              # table + modal + row model + export + table validation
    basePagination/
    gauge/                      # SemicircleGauge, GaugeTileLayout, gaugeMath, …
    editors/                    # InlineSelectEditor
    metrics/                    # MetricList
    tablePlugin/                # TablePluginShell + tablePluginShell.ts
    validation/                 # netValidation (shared by DHCP tiles)
  plugins/
    core/                       # registry, builtinMeta, pluginGridPolicy, tileOptionsZod, pluginDataBus
    dhcp/
    discovery/
    perf/                       # PerfTile, PerfMetricTile, PerfOptionsForm, tileDisplay
    fixtures/                   # E2EThrowingTile.svelte
  piholeCp/
    shell/                      # Operator app + dashboard shell + section tiles
    gateway/                    # PiholeCpGateway, PiholeCpDashboardGateway
    env/                        # Env settings + envConfigZod
    layout/                     # dashboardZod, buildLayoutFromDashboard, layoutResync
    perf/                       # perf poll, aggregate, postApplyWait
    logs/                       # LogStreamPanel
    session/                    # piholeCpSession, piholeCpApiToken
    plugins/                    # operatorBaselinePlugins, piholeHaPluginIds, sectionUi
    kea/                        # piholeCpKeaDhcp
    store/                      # piholeCpDashboardDataStore
    meta/                       # piholeCpUiVersion
  dashboard/                    # unchanged in Phase 1–4; optional Phase 5
  palette/
  platform/
  theme/
  admin/
```

**Naming:** Subfolder names use **camelCase** to match existing `dashboard/placement/`, `plugins/perf/`.

**Explicitly out of scope (this plan):** `dashboard/` root file moves (see Phase 5 pointer), `palette/` split, `$lib` alias introduction, renaming public types, OpenAPI or plugin-id contract changes.

---

## Ground rules

1. **Mechanical only** — no logic edits in the same commit as moves (whitespace-only import path changes allowed).
2. **`git mv`** for every file so history follows.
3. **One domain per commit** (components → plugins → piholeCp → lib root → docs).
4. **DCO:** `git commit -s`; verify repo-local identity per `.cursor/rules/commits.mdc`.
5. **CI:** `npm --prefix apps/ui run check:ui-unit` minimum each task; full `bash scripts/check_app.sh` before merge.
6. **Coverage:** Update `apps/ui/vite.config.ts` `coverage.exclude` paths when Svelte files move (see Task 1.4).

---

## Helper: bulk import rewrite (optional)

After each `git mv` batch, from repo root:

```bash
# Example: components flat → baseDataTable (run only after files moved)
rg -l 'components/BaseDataTable' apps/ui/src \
  | xargs sed -i '' \
    -e 's|components/BaseDataTable\.svelte|components/baseDataTable/BaseDataTable.svelte|g' \
    -e 's|components/baseDataTable|components/baseDataTable/baseDataTable|g'
```

Prefer **`rg` + careful `sed`** or IDE refactor over hand-editing. Always run unit tests before committing.

---

## Phase 1 — `components/`

### Task 1.1: Baseline

**Files:** none (verify only)

- [ ] **Step 1: Record green baseline**

Run:

```bash
npm --prefix apps/ui run check:ui-unit
```

Expected: PASS (100% line coverage on enforced paths).

- [ ] **Step 2: Commit** — skip (no changes).

---

### Task 1.2: Create `components/baseDataTable/`

**Files:**
- Move: all `BaseDataTable*`, `baseDataTable.ts`, `tableRowModel.ts`, `tableExport.ts`, `tableValidation.ts` (+ co-located tests/harnesses) → `components/baseDataTable/`

- [ ] **Step 1: Move files**

```bash
cd /Volumes/Data/piHole/pi-fabric
mkdir -p apps/ui/src/lib/components/baseDataTable
git mv apps/ui/src/lib/components/BaseDataTable.svelte apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/BaseDataTable.svelte.test.ts apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/BaseDataTableModal.svelte apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/BaseDataTableModal.test.ts apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/BaseDataTableModalSaveAllHarness.svelte apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/BaseDataTableCoverageHarness.svelte apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/BaseDataTablePageClampHarness.svelte apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/baseDataTable.ts apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/baseDataTable.test.ts apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/tableRowModel.ts apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/tableRowModel.test.ts apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/tableExport.ts apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/tableExport.test.ts apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/tableValidation.ts apps/ui/src/lib/components/baseDataTable/
git mv apps/ui/src/lib/components/tableValidation.test.ts apps/ui/src/lib/components/baseDataTable/
```

- [ ] **Step 2: Fix intra-folder imports**

Inside `baseDataTable/`, keep **relative** `./` imports (no path change needed if all files moved together).

- [ ] **Step 3: Fix external imports**

Update these files to use `../components/baseDataTable/...`:

- `apps/ui/src/lib/plugins/DhcpClientsTile.svelte`
- `apps/ui/src/lib/plugins/DhcpPoolsTile.svelte`
- `apps/ui/src/lib/plugins/DhcpReservationsTile.svelte`
- `apps/ui/src/lib/admin/AdminLogsPage.svelte`

Example:

```svelte
import BaseDataTable from "../components/baseDataTable/BaseDataTable.svelte";
import type { BaseDataTableColumn } from "../components/baseDataTable/baseDataTable";
```

- [ ] **Step 4: Run tests**

```bash
npm --prefix apps/ui run check:ui-unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A apps/ui/src/lib/components apps/ui/src/lib/plugins apps/ui/src/lib/admin
git commit -s -m "refactor(ui): group BaseDataTable module under components/baseDataTable"
```

---

### Task 1.3: `basePagination/`, `gauge/`, `editors/`, `metrics/`, `tablePlugin/`, `validation/`

**Files:** remaining flat `components/*` → subfolders per target tree.

- [ ] **Step 1: Move pagination**

```bash
mkdir -p apps/ui/src/lib/components/basePagination
git mv apps/ui/src/lib/components/BasePagination.svelte apps/ui/src/lib/components/basePagination/
git mv apps/ui/src/lib/components/BasePagination.svelte.test.ts apps/ui/src/lib/components/basePagination/
git mv apps/ui/src/lib/components/basePagination.ts apps/ui/src/lib/components/basePagination/
git mv apps/ui/src/lib/components/basePagination.test.ts apps/ui/src/lib/components/basePagination/
```

Update `baseDataTable/BaseDataTable.svelte`:

```svelte
import BasePagination from "../basePagination/BasePagination.svelte";
```

- [ ] **Step 2: Move gauge**

```bash
mkdir -p apps/ui/src/lib/components/gauge
git mv apps/ui/src/lib/components/SemicircleGauge.svelte apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/SemicircleGauge.test.ts apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/GaugeTileLayout.svelte apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/GaugeTileLayout.svelte.test.ts apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/GaugeTileLayoutHarness.svelte apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/gaugeMath.ts apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/gaugeMath.test.ts apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/gaugeDisplay.ts apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/gaugeDisplay.test.ts apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/gaugeThresholds.ts apps/ui/src/lib/components/gauge/
git mv apps/ui/src/lib/components/gaugeThresholds.test.ts apps/ui/src/lib/components/gauge/
```

Update plugin/admin imports, e.g. `PerfMetricTile.svelte`:

```svelte
import GaugeTileLayout from "../components/gauge/GaugeTileLayout.svelte";
import SemicircleGauge from "../components/gauge/SemicircleGauge.svelte";
```

- [ ] **Step 3: Move editors, metrics, tablePlugin, validation**

```bash
mkdir -p apps/ui/src/lib/components/{editors,metrics,tablePlugin,validation}
git mv apps/ui/src/lib/components/InlineSelectEditor.svelte apps/ui/src/lib/components/editors/
git mv apps/ui/src/lib/components/InlineSelectEditor.svelte.test.ts apps/ui/src/lib/components/editors/
git mv apps/ui/src/lib/components/MetricList.svelte apps/ui/src/lib/components/metrics/
git mv apps/ui/src/lib/components/MetricList.svelte.test.ts apps/ui/src/lib/components/metrics/
git mv apps/ui/src/lib/components/TablePluginShell.svelte apps/ui/src/lib/components/tablePlugin/
git mv apps/ui/src/lib/components/TablePluginShell.test.ts apps/ui/src/lib/components/tablePlugin/
git mv apps/ui/src/lib/components/tablePluginShell.ts apps/ui/src/lib/components/tablePlugin/
git mv apps/ui/src/lib/components/netValidation.ts apps/ui/src/lib/components/validation/
git mv apps/ui/src/lib/components/netValidation.test.ts apps/ui/src/lib/components/validation/
```

Update `baseDataTable/BaseDataTable.svelte`:

```svelte
import InlineSelectEditor from "../editors/InlineSelectEditor.svelte";
```

Update `DhcpReservationsTile.svelte`:

```svelte
import { validateIpv4Address, validateMacAddress } from "../components/validation/netValidation";
```

Update `tablePlugin/tablePluginShell.ts`:

```typescript
export type { BaseDataTableColumn as TableShellColumn } from "../baseDataTable/baseDataTable";
```

- [ ] **Step 4: Run tests**

```bash
npm --prefix apps/ui run check:ui-unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -s -am "refactor(ui): split components into basePagination, gauge, editors, metrics, validation"
```

---

### Task 1.4: Vitest coverage paths for components

**Files:**
- Modify: `apps/ui/vite.config.ts` (`coverage.exclude` entries)

- [ ] **Step 1: Update exclude paths**

Replace:

```typescript
"src/lib/components/BaseDataTableModal.svelte",
"src/lib/components/InlineSelectEditor.svelte",
"src/lib/components/BaseDataTable.svelte",
"src/lib/components/tablePluginShell.ts",
```

With:

```typescript
"src/lib/components/baseDataTable/BaseDataTableModal.svelte",
"src/lib/components/editors/InlineSelectEditor.svelte",
"src/lib/components/baseDataTable/BaseDataTable.svelte",
"src/lib/components/tablePlugin/tablePluginShell.ts",
```

- [ ] **Step 2: Run tests**

```bash
npm --prefix apps/ui run check:ui-unit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git commit -s -m "chore(ui): align vitest coverage excludes with component folders"
```

---

## Phase 2 — `plugins/`

### Task 2.1: `plugins/core/`

**Files:**
- Move: `registry.ts`, `registry.test.ts`, `builtinMeta.ts`, `builtinMeta.test.ts`, `pluginGridPolicy.ts`, `pluginDataBus.ts`, `pluginDataBus.test.ts`, `pluginDataBusUseProbe.test.svelte`, `tileOptionsZod.ts`, `tileDisplay.ts`, `tileDisplay.test.ts`

- [ ] **Step 1: Move core runtime**

```bash
mkdir -p apps/ui/src/lib/plugins/core
git mv apps/ui/src/lib/plugins/registry.ts apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/registry.test.ts apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/builtinMeta.ts apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/builtinMeta.test.ts apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/pluginGridPolicy.ts apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/pluginDataBus.ts apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/pluginDataBus.test.ts apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/pluginDataBusUseProbe.test.svelte apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/tileOptionsZod.ts apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/tileDisplay.ts apps/ui/src/lib/plugins/core/
git mv apps/ui/src/lib/plugins/tileDisplay.test.ts apps/ui/src/lib/plugins/core/
```

- [ ] **Step 2: Fix `registry.ts` imports**

```typescript
import type { DataGateway } from "../../gateway/dataGateway";
import type { FabricEventBus } from "../../dashboard/eventBus";
import type { DashboardTile } from "../../dashboard/types";
import { applyPerfCompactAsPercentOnly } from "./tileDisplay";
import DhcpClientsTile from "../dhcp/DhcpClientsTile.svelte";
// … etc (tile paths updated in Task 2.2)
```

- [ ] **Step 3: Update all importers**

| Old import | New import |
| --- | --- |
| `../plugins/registry` | `../plugins/core/registry` |
| `../plugins/builtinMeta` | `../plugins/core/builtinMeta` |
| `../plugins/pluginGridPolicy` | `../plugins/core/pluginGridPolicy` |
| `../plugins/tileOptionsZod` | `../plugins/core/tileOptionsZod` |
| `./plugins/registry` (from `lib/operatorBoot.test.ts`) | `./plugins/core/registry` |

Files to grep-update:

```bash
rg -l 'plugins/(registry|builtinMeta|pluginGridPolicy|tileOptionsZod|pluginDataBus|tileDisplay)' apps/ui/src
```

Also update `apps/ui/src/lib/dashboard/tileOptionsZod.ts` barrel:

```typescript
export { tileOptionsSchemaForPlugin } from "../plugins/core/tileOptionsZod";
```

And `apps/ui/src/lib/platform/extensions/dashboardTileRegistry.ts`:

```typescript
} from "../../plugins/core/registry";
```

- [ ] **Step 4: Run tests + plugin guard**

```bash
npm --prefix apps/ui run check:ui-unit
ENFORCE_UI_PLUGIN_GUARD=1 bash scripts/check_ui_plugin_guard.sh
```

Expected: PASS; guard still 0 occurrences outside `lib/plugins/`.

- [ ] **Step 5: Commit**

```bash
git commit -s -am "refactor(ui): move plugin registry and shared runtime to plugins/core"
```

---

### Task 2.2: Tile folders `dhcp/`, `discovery/`, `perf/`, `fixtures/`

**Files:**
- Move tile Svelte files; merge root `perf/` helpers with tile files where logical.

- [ ] **Step 1: Move DHCP tiles**

```bash
mkdir -p apps/ui/src/lib/plugins/dhcp
git mv apps/ui/src/lib/plugins/DhcpClientsTile.svelte apps/ui/src/lib/plugins/dhcp/
git mv apps/ui/src/lib/plugins/DhcpPoolsTile.svelte apps/ui/src/lib/plugins/dhcp/
git mv apps/ui/src/lib/plugins/DhcpReservationsTile.svelte apps/ui/src/lib/plugins/dhcp/
```

- [ ] **Step 2: Move discovery + perf tiles**

```bash
mkdir -p apps/ui/src/lib/plugins/discovery apps/ui/src/lib/plugins/fixtures
git mv apps/ui/src/lib/plugins/DiscoveryTile.svelte apps/ui/src/lib/plugins/discovery/
git mv apps/ui/src/lib/plugins/E2EThrowingTile.svelte apps/ui/src/lib/plugins/fixtures/
git mv apps/ui/src/lib/plugins/PerfTile.svelte apps/ui/src/lib/plugins/perf/
git mv apps/ui/src/lib/plugins/PerfMetricTile.svelte apps/ui/src/lib/plugins/perf/
# PerfOptionsForm*.svelte already under plugins/perf/
```

- [ ] **Step 3: Fix tile import paths**

Example `dhcp/DhcpClientsTile.svelte`:

```svelte
import BaseDataTable from "../../components/baseDataTable/BaseDataTable.svelte";
import type { BaseDataTableColumn } from "../../components/baseDataTable/baseDataTable";
```

Example `perf/PerfTile.svelte`:

```svelte
import MetricList from "../../components/metrics/MetricList.svelte";
import SemicircleGauge from "../../components/gauge/SemicircleGauge.svelte";
```

- [ ] **Step 4: Fix `core/registry.ts` tile imports**

```typescript
import DhcpClientsTile from "../dhcp/DhcpClientsTile.svelte";
import DhcpPoolsTile from "../dhcp/DhcpPoolsTile.svelte";
import DhcpReservationsTile from "../dhcp/DhcpReservationsTile.svelte";
import DiscoveryTile from "../discovery/DiscoveryTile.svelte";
import PerfMetricTile from "../perf/PerfMetricTile.svelte";
import PerfTile from "../perf/PerfTile.svelte";
import PerfTileSettingsForm from "../perf/PerfOptionsForm.svelte";
```

- [ ] **Step 5: Run tests**

```bash
npm --prefix apps/ui run check:ui-unit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -s -am "refactor(ui): group built-in tiles under plugins/dhcp, discovery, perf"
```

---

## Phase 3 — `piholeCp/`

### Task 3.1: Gateway + session + meta

**Files:**
- Move: `PiholeCpGateway.ts`, `PiholeCpGateway.test.ts`, `PiholeCpDashboardGateway.ts`, `PiholeCpDashboardGateway.test.ts`, `piholeCpSession.ts`, `piholeCpSession.test.ts`, `piholeCpApiToken.ts`, `piholeCpApiToken.test.ts`, `piholeCpUiVersion.ts`, `piholeCpUiVersion.test.ts`

- [ ] **Step 1: Move**

```bash
mkdir -p apps/ui/src/lib/piholeCp/{gateway,session,meta}
git mv apps/ui/src/lib/piholeCp/PiholeCpGateway.ts apps/ui/src/lib/piholeCp/gateway/
git mv apps/ui/src/lib/piholeCp/PiholeCpGateway.test.ts apps/ui/src/lib/piholeCp/gateway/
git mv apps/ui/src/lib/piholeCp/PiholeCpDashboardGateway.ts apps/ui/src/lib/piholeCp/gateway/
git mv apps/ui/src/lib/piholeCp/PiholeCpDashboardGateway.test.ts apps/ui/src/lib/piholeCp/gateway/
git mv apps/ui/src/lib/piholeCp/piholeCpSession.ts apps/ui/src/lib/piholeCp/session/
git mv apps/ui/src/lib/piholeCp/piholeCpSession.test.ts apps/ui/src/lib/piholeCp/session/
git mv apps/ui/src/lib/piholeCp/piholeCpApiToken.ts apps/ui/src/lib/piholeCp/session/
git mv apps/ui/src/lib/piholeCp/piholeCpApiToken.test.ts apps/ui/src/lib/piholeCp/session/
git mv apps/ui/src/lib/piholeCp/piholeCpUiVersion.ts apps/ui/src/lib/piholeCp/meta/
git mv apps/ui/src/lib/piholeCp/piholeCpUiVersion.test.ts apps/ui/src/lib/piholeCp/meta/
```

- [ ] **Step 2: Update cross-package imports**

`lib/dashboard/transports/cpFabricTransport.ts`:

```typescript
import type { PiholeCpDashboardGateway } from "../../piholeCp/gateway/PiholeCpDashboardGateway";
import { /* … */ } from "../../piholeCp/perf/piholeCpPerfAggregate";
```

(perf paths completed in Task 3.2.)

`PiholeOperatorApp.svelte`:

```typescript
import { waitForPiholeCpDashboardCoherent, type PiholeCpMeta } from "./gateway/PiholeCpGateway";
import type { PiholeCpDashboardGateway } from "./gateway/PiholeCpDashboardGateway";
import { createPiholeCpSession } from "./session/piholeCpSession";
```

- [ ] **Step 3: Run tests**

```bash
npm --prefix apps/ui run check:ui-unit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -s -am "refactor(ui): split piholeCp gateway, session, and meta modules"
```

---

### Task 3.2: Shell, layout, perf, env, logs, plugins, kea, store

**Files:** all remaining `piholeCp/*` per target tree.

- [ ] **Step 1: Move shell components**

```bash
mkdir -p apps/ui/src/lib/piholeCp/shell
git mv apps/ui/src/lib/piholeCp/PiholeOperatorApp.svelte apps/ui/src/lib/piholeCp/shell/
git mv apps/ui/src/lib/piholeCp/PiholeOperatorApp.svelte.test.ts apps/ui/src/lib/piholeCp/shell/
git mv apps/ui/src/lib/piholeCp/PiholeCpDashboardShell.svelte apps/ui/src/lib/piholeCp/shell/
git mv apps/ui/src/lib/piholeCp/PiholeCpShellHeader.svelte apps/ui/src/lib/piholeCp/shell/
git mv apps/ui/src/lib/piholeCp/SectionDashboardTile.svelte apps/ui/src/lib/piholeCp/shell/
git mv apps/ui/src/lib/piholeCp/SectionDashboardTile.svelte.test.ts apps/ui/src/lib/piholeCp/shell/
git mv apps/ui/src/lib/piholeCp/PiholeHaSectionPluginTile.svelte apps/ui/src/lib/piholeCp/shell/
```

Update `apps/ui/src/piholeCp-entry.ts`:

```typescript
import PiholeOperatorApp from "./lib/piholeCp/shell/PiholeOperatorApp.svelte";
```

- [ ] **Step 2: Move layout, perf, env, logs, plugins, kea, store**

```bash
mkdir -p apps/ui/src/lib/piholeCp/{layout,perf,env,logs,plugins,kea,store}
git mv apps/ui/src/lib/piholeCp/dashboardZod.ts apps/ui/src/lib/piholeCp/layout/
git mv apps/ui/src/lib/piholeCp/buildLayoutFromDashboard.ts apps/ui/src/lib/piholeCp/layout/
git mv apps/ui/src/lib/piholeCp/buildLayoutFromDashboard.test.ts apps/ui/src/lib/piholeCp/layout/
git mv apps/ui/src/lib/piholeCp/piholeCpLayoutResync.ts apps/ui/src/lib/piholeCp/layout/
git mv apps/ui/src/lib/piholeCp/piholeCpLayoutResync.test.ts apps/ui/src/lib/piholeCp/layout/
git mv apps/ui/src/lib/piholeCp/piholeCpPerfPoll.ts apps/ui/src/lib/piholeCp/perf/
git mv apps/ui/src/lib/piholeCp/piholeCpPerfPoll.test.ts apps/ui/src/lib/piholeCp/perf/
git mv apps/ui/src/lib/piholeCp/piholeCpPerfAggregate.ts apps/ui/src/lib/piholeCp/perf/
git mv apps/ui/src/lib/piholeCp/piholeCpPerfAggregate.test.ts apps/ui/src/lib/piholeCp/perf/
git mv apps/ui/src/lib/piholeCp/piholeCpPostApplyWait.ts apps/ui/src/lib/piholeCp/perf/
git mv apps/ui/src/lib/piholeCp/piholeCpPostApplyWait.test.ts apps/ui/src/lib/piholeCp/perf/
git mv apps/ui/src/lib/piholeCp/PiholeCpEnvSettings.svelte apps/ui/src/lib/piholeCp/env/
git mv apps/ui/src/lib/piholeCp/PiholeCpEnvSettings.svelte.test.ts apps/ui/src/lib/piholeCp/env/
git mv apps/ui/src/lib/piholeCp/envConfigZod.ts apps/ui/src/lib/piholeCp/env/
git mv apps/ui/src/lib/piholeCp/envConfigZod.test.ts apps/ui/src/lib/piholeCp/env/
git mv apps/ui/src/lib/piholeCp/LogStreamPanel.svelte apps/ui/src/lib/piholeCp/logs/
git mv apps/ui/src/lib/piholeCp/LogStreamPanel.svelte.test.ts apps/ui/src/lib/piholeCp/logs/
git mv apps/ui/src/lib/piholeCp/operatorBaselinePlugins.ts apps/ui/src/lib/piholeCp/plugins/
git mv apps/ui/src/lib/piholeCp/operatorBaselinePlugins.test.ts apps/ui/src/lib/piholeCp/plugins/
git mv apps/ui/src/lib/piholeCp/piholeHaPluginIds.ts apps/ui/src/lib/piholeCp/plugins/
git mv apps/ui/src/lib/piholeCp/piholeHaPluginIds.test.ts apps/ui/src/lib/piholeCp/plugins/
git mv apps/ui/src/lib/piholeCp/sectionUi.ts apps/ui/src/lib/piholeCp/plugins/
git mv apps/ui/src/lib/piholeCp/sectionUi.test.ts apps/ui/src/lib/piholeCp/plugins/
git mv apps/ui/src/lib/piholeCp/piholeCpKeaDhcp.ts apps/ui/src/lib/piholeCp/kea/
git mv apps/ui/src/lib/piholeCp/piholeCpKeaDhcp.test.ts apps/ui/src/lib/piholeCp/kea/
git mv apps/ui/src/lib/piholeCp/piholeCpDashboardDataStore.ts apps/ui/src/lib/piholeCp/store/
```

- [ ] **Step 3: Fix `layoutStore` import**

`apps/ui/src/lib/dashboard/layoutStore.ts`:

```typescript
import { defaultPaletteOptionsForPiholeHaPlugin } from "../piholeCp/plugins/piholeHaPluginIds";
```

- [ ] **Step 4: Run full UI checks**

```bash
npm --prefix apps/ui run check:ui-unit
npm --prefix apps/ui run check:ui-e2e
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -s -am "refactor(ui): organize piholeCp into shell, layout, perf, env, logs, plugins"
```

---

## Phase 4 — `lib/` root → `app/`, `gateway/`, `version/`

### Task 4.1: App shell and gateway

**Files:**
- Move: `appDashboardShell.ts`, `appMount.ts`, `operatorBoot.ts` (+ tests) → `lib/app/`
- Move: `dataGateway.ts` (+ test) → `lib/gateway/`
- Move: `uiVersion.ts` (+ test) → `lib/version/`
- Move: `mockRoutes.test.ts` → `lib/api/`

- [ ] **Step 1: Move files**

```bash
mkdir -p apps/ui/src/lib/{app,gateway,version}
git mv apps/ui/src/lib/appDashboardShell.ts apps/ui/src/lib/app/
git mv apps/ui/src/lib/appDashboardShell.test.ts apps/ui/src/lib/app/
git mv apps/ui/src/lib/appMount.ts apps/ui/src/lib/app/
git mv apps/ui/src/lib/appMount.test.ts apps/ui/src/lib/app/
git mv apps/ui/src/lib/operatorBoot.ts apps/ui/src/lib/app/
git mv apps/ui/src/lib/operatorBoot.test.ts apps/ui/src/lib/app/
git mv apps/ui/src/lib/dataGateway.ts apps/ui/src/lib/gateway/
git mv apps/ui/src/lib/dataGateway.test.ts apps/ui/src/lib/gateway/
git mv apps/ui/src/lib/uiVersion.ts apps/ui/src/lib/version/
git mv apps/ui/src/lib/uiVersion.test.ts apps/ui/src/lib/version/
git mv apps/ui/src/lib/mockRoutes.test.ts apps/ui/src/lib/api/
```

- [ ] **Step 2: Update entrypoints**

`apps/ui/src/App.svelte`:

```typescript
import { createAppDashboardShell } from "./lib/app/appDashboardShell";
import { attachOperatorShellLifecycle } from "./lib/app/appMount";
import { DataGateway } from "./lib/gateway/dataGateway";
```

`apps/ui/src/main.ts`:

```typescript
import { mountOperatorApp } from "./lib/app/operatorBoot";
```

- [ ] **Step 3: Bulk-update `dataGateway` imports**

```bash
rg -l 'from "\.\./dataGateway"|from "\./dataGateway"|from "\.\./\.\./dataGateway"' apps/ui/src \
  | while read -r f; do
      # hand-verify each file: typically ../gateway/dataGateway or ../../gateway/dataGateway
    done
```

Patterns:

| Was | Becomes (example from `lib/dashboard/`) |
| --- | --- |
| `../dataGateway` | `../gateway/dataGateway` |
| `../../dataGateway` | `../../gateway/dataGateway` |
| `./dataGateway` (from `lib/app/`) | `../gateway/dataGateway` |

- [ ] **Step 4: Fix `app/appDashboardShell.ts`**

```typescript
import type { DataGateway } from "../gateway/dataGateway";
```

- [ ] **Step 5: Fix `app/operatorBoot.test.ts`**

```typescript
import { resolvePluginTileMount } from "../plugins/core/registry";
```

- [ ] **Step 6: Run full checks**

```bash
bash scripts/check_app.sh
npm --prefix apps/ui run check:ui-e2e
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git commit -s -am "refactor(ui): move app shell, gateway, and version out of lib root"
```

---

## Phase 5 — Documentation (required)

### Task 5.1: Refresh architecture map

**Files:**
- Modify: `docs/architecture/ui-component-and-service-map.md` (§ file path tables, `DataGateway` path, component paths)

- [ ] **Step 1: Update path references**

Replace flat paths such as:

- `apps/ui/src/lib/dataGateway.ts` → `apps/ui/src/lib/gateway/dataGateway.ts`
- `apps/ui/src/lib/piholeCp/PiholeCpGateway.ts` → `apps/ui/src/lib/piholeCp/gateway/PiholeCpGateway.ts`
- Add a short **“Module layout (2026-05)”** subsection listing `components/*`, `plugins/*`, `piholeCp/*` subfolders (bullet list from target tree).

- [ ] **Step 2: Run docs text check**

```bash
npm run check:docs-text
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git commit -s -m "docs: update ui-component map for lib folder restructure"
```

---

## Phase 6 — Optional: `dashboard/` root cleanup

**Not required for this PR.** The separation-of-concerns plan already split `placement/`, `editor/`, `interactions/`. Remaining ~70 root files can move in a **follow-up** branch using this sketch (no tasks here — avoid scope creep):

| Subfolder | Examples |
| --- | --- |
| `dashboard/tiles/` | `PluginTileMount`, `TileErrorBoundary`, `TileSettingsOverlay`, … |
| `dashboard/layout/` | `layoutStore`, `layoutStorage`, `layoutTree`, `layoutZod`, … (distinct from `placement/` math) |
| `dashboard/bus/` | `eventBus`, `fabricBusKernel`, `fabricBusConnection` |
| `dashboard/pages/` | `DashboardPage`, `DashboardHost` |

Only start after folder restructure merges to `main`.

---

## Self-review

### 1. Spec coverage (user request)

| Request | Task |
| --- | --- |
| `components/` subfolders (BaseDataTable, BasePagination, Gauge, Validations, …) | Phase 1, Tasks 1.2–1.3 |
| `piholeCp/` logical subfolders | Phase 3 |
| `plugins/` logical subfolders | Phase 2 |
| `lib/` root declutter | Phase 4 |
| `dashboard/` long list | Phase 6 (optional pointer only) |

### 2. Placeholder scan

No TBD/TODO steps; each move lists concrete paths and sample import fixes.

### 3. Type consistency

- `PiholeCpMeta`, `DataGateway`, `BaseDataTableColumn` names unchanged — only paths move.
- `plugins/core/registry.ts` remains the implementation; `platform/extensions/dashboardTileRegistry.ts` remains the public import surface for hosts.

### 4. CI guards

- `check_ui_plugin_guard.sh`: still passes if `pluginId ===` stays under `lib/plugins/`.
- Vitest coverage: Task 1.4 + verify `coverage.include` still `src/lib/**/*.ts` (unchanged).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-17-ui-lib-folder-restructure.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — one fresh subagent per task (1.2, 1.3, 2.1, …), review between tasks.
2. **Inline Execution** — run phases sequentially in this session with `executing-plans` checkpoints after each commit.

Which approach?
