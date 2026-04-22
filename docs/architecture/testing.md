---
title: Testing Architecture
tier: C
gate: Rolling
owner: GriffinAD
peer_reviewer: GriffinAD
status: Accepted
last_review: 2026-04-19
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

- **Minimum quality bar:** 90%+ coverage on testable code surfaces.
- **Project target:** 100% coverage where practical.
- Existing Python gate keeps `kea_fabric` coverage near full line coverage
  (current `fail_under` in `pyproject.toml` is 99).
- UI coverage policy follows the same principle: keep above 90% and push toward
  100% as UI surfaces land.

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
