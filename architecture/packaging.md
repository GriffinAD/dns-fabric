---
title: Packaging Architecture
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
# Packaging Architecture

## Scope

Defines build/package outputs across native packages, containers, Helm, and
air-gapped bundles with reproducibility constraints.

## Acceptance criteria for Rolling close

- [ ] Package matrix finalized for supported platform tiers.
- [ ] Runtime staging process documented (including bundled Python policy).
- [x] Reproducible-build controls captured and testable.
- [x] SBOM and vulnerability scanning hooks integrated.

## Packaging outline

Current baseline (Phase 5 chunk):

- Python artifacts are built with `uv build` into `dist/`.
- `scripts/check_release_artifacts.py` enforces expected artifact names for the
  in-tree `__version__` and fails if files are missing/empty.
- `release.yml` generates `dist/SHA256SUMS.txt` to lock artifact integrity.
- Security scanning is integrated as a required CI lane:
  - `gitleaks` (secret scanning),
  - `Syft` (CycloneDX SBOM),
  - `Grype --fail-on high` (vulnerability policy gate).

Future expansion remains open for native packages, OCI multi-arch, and offline
bundles, but the Python package release path is now enforced and reproducible.

## Cross-refs

- `platform-support.md`
- `deployment.md`
- `cicd.md`
- `release-process.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C packaging architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
| 2026-04-20 | Accepted | GriffinAD | Phase 5 chunk: reproducible Python artifact checks + checksum and SBOM/vuln pipeline hooks documented. |
