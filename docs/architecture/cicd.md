---
title: CI/CD Architecture
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
# CI/CD Architecture

## Scope

Defines phased CI/CD model: Phase-2 minimum subset and Phase-5 full matrix
release pipeline.

## Acceptance criteria for Rolling close

- [x] Phase-2 minimum CI subset documented and enforceable (see `python.yml`,
  `docs.yml`, `security.yml`, `dco.yml`, and repo `check` / `ci:all` scripts).
- [x] Phase-5 release pipeline stages and gates documented.
- [x] Required scans/checks listed with pass/fail criteria.
- [x] Release channel mapping aligns with ADR-0020.

## Pipeline outline

Pull-request and push validation runs through `python.yml`, `docs.yml`,
`ui.yml`, `security.yml`, and `dco.yml`. Release publishing is implemented by
`.github/workflows/release.yml`, which:

1. Triggers on tag pushes `v*` and `workflow_dispatch`.
2. Re-runs the application gate (`bash scripts/check_app.sh`).
3. Verifies release artifacts (`scripts/check_release_artifacts.py`).
4. Emits deterministic checksums (`dist/SHA256SUMS.txt`).
5. Uploads build artifacts and publishes a GitHub release for tag events.

Pass/fail criteria:

- **Blocking:** `ruff`, `mypy`, `pytest` + coverage gate, OpenAPI drift,
  specs validation, package build (`check_app.sh`).
- **Blocking:** UI unit/component coverage and Playwright automation (`ui.yml`).
- **Blocking:** release artifact validation script and checksum generation.
- **Blocking:** security workflow (gitleaks, Syft SBOM, Grype high+).
- **Blocking:** DCO workflow for signed-off commits.

Release-channel mapping (ADR-0020):

- Tags on `main` use `vX.Y.Z` for stable channel releases.
- Pre-release tags `vX.Y.Z-rc.N` map to pre-release channel.
- Branch-cut policy (`release/X.Y`) remains the source branch model; tags are
  the publication trigger in this baseline workflow.

## Cross-refs

- `testing.md`
- `packaging.md`
- `release-process.md`
- `deployment.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C CI/CD architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
| 2026-04-20 | Accepted | GriffinAD | Phase 5 chunk: documented release workflow (`release.yml`), artifact verification, and release-channel mapping. |
| 2026-04-20 | Accepted | GriffinAD | Phase 6 chunk: added `ui.yml` gate for Vitest coverage and Playwright automation. |
