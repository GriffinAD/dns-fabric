---
title: Release Process Architecture
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
# Release Process Architecture

## Scope

Defines branch/tag model, release channels, migration communication, and rollback
rules for platform and plugin ecosystem changes.

## Acceptance criteria for Rolling close

- [x] Branching/channel rules published and toolable.
- [x] Release checklist includes migration and rollback notes.
- [ ] Compatibility matrix publication process defined.
- [ ] Incident-driven hotfix process documented.

## Process outline

Channel-aligned releases are published from tags using
`.github/workflows/release.yml`.

Release checklist baseline:

1. Ensure `main` or `release/X.Y` branch is green (`python`, `docs`,
   `security`, `dco` workflows).
2. Tag the release with `vX.Y.Z` (or pre-release `vX.Y.Z-rc.N`).
3. Workflow runs `check_app.sh`, validates `dist/` artifacts, and produces
   `SHA256SUMS.txt`.
4. GitHub release is published with wheel/sdist/checksum artifacts.
5. Include migration/rollback note section in release notes (operator impact,
   config schema changes, API compatibility notes).

## Cross-refs

- `versioning.md`
- `cicd.md`
- `packaging.md`
- `deployment.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C release process architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
| 2026-04-20 | Accepted | GriffinAD | Phase 5 chunk: tag-driven release workflow and release checklist baseline documented. |
