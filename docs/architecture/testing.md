---
title: Testing Architecture
tier: C
gate: Rolling
owner: GriffinAD
peer_reviewer: GriffinAD
status: Accepted
last_review: 2026-04-26
adrs: []
invariants: []
---

<!-- markdownlint-disable MD025 -->
# Testing Architecture

## Scope

Defines test layers (unit, contract, integration, UI, e2e, packaging) and
minimum quality thresholds per subsystem.

## Acceptance criteria for Rolling close

- [x] Test pyramid defined with ownership per layer.
- [ ] Contract test harnesses available for plugin authors.
- [x] Critical-path scenarios mapped to automated suites.
- [x] Coverage and mutation goals documented.

## Strategy outline

Prioritize contract fidelity and failure-mode validation for core runtime,
policy/broker paths, plugin lifecycle, and Kea integration operations.

### Test pyramid and ownership

- **Python backend (`src/kea_fabric/`)**: `pytest` unit/integration tests under
  `tests/`.
- **UI unit/component (`apps/ui/`)**: **Vitest** as the required runner/tooling.
- **UI automation/e2e (`apps/ui/` + API surface)**: **Playwright** for browser-level
  flows and regression scenarios.
- **Contracts/spec parity**: OpenAPI/spec checks remain part of the CI gate.

### Critical-path automation map

- API lifecycle, plugin host states, audit/event durability, and policy checks:
  covered in Python tests + `check_app.sh`.
- UI shell/component behavior: Vitest component and store/unit tests.
- User journey automation (routing, auth/session flow, plugin UI interactions):
  Playwright suites against built/running app.

### Coverage goals

- **Target:** **100%** line coverage on testable code surfaces; treat uncovered
  lines as debt to clear when touching nearby code.
- **Python (`src/kea_fabric/`):** `tool.coverage.report.fail_under` in
  `pyproject.toml` is **100** — CI must not regress below **100%** on
  `src/kea_fabric/`.
- **UI (`apps/ui/`):** Vitest coverage thresholds in `apps/ui/vite.config.ts`
  enforce **100%** lines, statements, and functions on the **included** tree
  (`src/lib/**/*.ts`, `src/lib/components/**/*.svelte`, `src/lib/theme/**/*.svelte`).
  **Branches** use a **98%** floor (Svelte 5 + v8 instrumentation leaves a small
  share of template branches infeasible to hit cleanly while keeping line
  coverage strict).
- **UI breadth (policy):** Every shipped operator surface **should** carry
  automated tests (Vitest and/or Playwright). The Vitest `coverage.include` list
  is intentionally **incremental**: expand it to more `src/lib/**/*.svelte`
  bundles (dashboard shell, palette, plugin tiles, admin) as dedicated mount
  tests land, so CI line coverage matches the same bar as TypeScript modules.
- **Bootstrap:** `apps/ui/src/main.ts` applies theme/dashboard document preferences
  then calls `mountOperatorApp` from `apps/ui/src/lib/operatorBoot.ts`, which is
  unit-tested (success path mounts `App.svelte`, failure path, and optional
  `VITE_E2E_THROWING` registration).

## Cross-refs

- `contracts.md`
- `api.md`
- `plugins.md`
- `cicd.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C testing architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
| 2026-04-20 | Accepted | GriffinAD | Testing stack update: Vitest for UI unit/component tests, Playwright for UI automation, and explicit 90%+ / target-100% coverage policy. |
| 2026-04-22 | Accepted | GriffinAD | **100%** coverage as the project target; **99%** as the enforced CI floor (`fail_under` / Vitest thresholds), replacing the prior 90%+ minimum. |
| 2026-04-24 | Accepted | GriffinAD | Raised enforced floors to **100%**: Python `fail_under` and Vitest coverage thresholds; clarified UI Vitest include scope. |
| 2026-04-26 | Accepted | GriffinAD | Documented UI **branch** floor (98%), incremental Svelte coverage include policy, and `operatorBoot` / `main` split for tested bootstrap. |
