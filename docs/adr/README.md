# Architecture Decision Records

> Every architectural decision lives here as an MADR record. Use
> [`docs/_templates/ADR_TEMPLATE.md`](../_templates/ADR_TEMPLATE.md) as the
> starting skeleton.

Conventions are enforced by [`.cursor/rules/adr.mdc`](../../.cursor/rules/adr.mdc):

- ID format: `ADR-NNNN-<slug>.md` (four-digit stable ID).
- Statuses: `Proposed | Accepted | Deferred | Superseded-by: ADR-XXXX | Future-Considered/Reserved`.
- `Deferred` requires `owner` + `due_date`.
- `Future-Considered/Reserved` requires `re_entry_criteria` + `touch_points`
  and MUST appear in [`../architecture/future-considerations.md`](../architecture/future-considerations.md).

## Index

| ID | File |
| --- | --- |
| ADR-0001 | [phase-1-documentation-gate](ADR-0001-phase-1-documentation-gate.md) |
| ADR-0002 | [plugin-isolation](ADR-0002-plugin-isolation.md) |
| ADR-0003 | [core-decomposition](ADR-0003-core-decomposition.md) |
| ADR-0004 | [legacy-monolith-exclusion](ADR-0004-legacy-monolith-exclusion.md) |
| ADR-0005 | [http-stack-fastapi](ADR-0005-http-stack-fastapi.md) |
| ADR-0006 | [ui-shell-svelte-5](ADR-0006-ui-shell-svelte-5.md) |
| ADR-0007 | [authentication-oidc-local](ADR-0007-authentication-oidc-local.md) |
| ADR-0008 | [persistence-tiers](ADR-0008-persistence-tiers.md) |
| ADR-0009 | [signing-artifacts-future](ADR-0009-signing-artifacts-future.md) |
| ADR-0010 | [configuration-model](ADR-0010-configuration-model.md) |
| ADR-0011 | [nebula-sync-details-deferred](ADR-0011-nebula-sync-details-deferred.md) |
| ADR-0012 | [audit-integrity-hash-chain](ADR-0012-audit-integrity-hash-chain.md) |
| ADR-0013 | [plugin-distribution-local](ADR-0013-plugin-distribution-local.md) |
| ADR-0014 | [topology-warm-standby](ADR-0014-topology-warm-standby.md) |
| ADR-0015 | [default-locale-en](ADR-0015-default-locale-en.md) |
| ADR-0016 | [ui-icons-lucide-registry](ADR-0016-ui-icons-lucide-registry.md) |
| ADR-0017 | [ui-fonts-self-hosted](ADR-0017-ui-fonts-self-hosted.md) |
| ADR-0018 | [spa-web-components-mount](ADR-0018-spa-web-components-mount.md) |
| ADR-0019 | [cicd-signing-slsa-future](ADR-0019-cicd-signing-slsa-future.md) |
| ADR-0020 | [release-channels](ADR-0020-release-channels.md) |
| ADR-0021 | [contract-conformance-harness](ADR-0021-contract-conformance-harness.md) |
| ADR-0022 | [observability-baseline](ADR-0022-observability-baseline.md) |
| ADR-0023 | [migrations-alembic](ADR-0023-migrations-alembic.md) |
| ADR-0024 | [documentation-english-only](ADR-0024-documentation-english-only.md) |
| ADR-0025 | [contributor-license-dco](ADR-0025-contributor-license-dco.md) |
| ADR-0026 | [api-operational-controls](ADR-0026-api-operational-controls.md) |
| ADR-0027 | [nebula-fencing-observe-only](ADR-0027-nebula-fencing-observe-only.md) |
| ADR-0028 | [retention-defaults](ADR-0028-retention-defaults.md) |
| ADR-0029 | [plugin-sandboxing-thresholds](ADR-0029-plugin-sandboxing-thresholds.md) |
| ADR-0030 | [state-replication-mechanism-deferred](ADR-0030-state-replication-mechanism-deferred.md) |
| ADR-0031 | [platform-support-matrix](ADR-0031-platform-support-matrix.md) |
| ADR-0032 | [data-access-orm-hybrid](ADR-0032-data-access-orm-hybrid.md) |
| ADR-0033 | [phase-2-application-skeleton-complete](ADR-0033-phase-2-application-skeleton-complete.md) |
| ADR-0034 | [phase-3-core-plugin-platform-complete](ADR-0034-phase-3-core-plugin-platform-complete.md) |
| ADR-0035 | [phase-4-reference-plugins-complete](ADR-0035-phase-4-reference-plugins-complete.md) |
| ADR-0036 | [phase-5-packaging-and-durable-events-complete](ADR-0036-phase-5-packaging-and-durable-events-complete.md) |
| ADR-0037 | [phase-6-ui-testing-and-shell-baseline-complete](ADR-0037-phase-6-ui-testing-and-shell-baseline-complete.md) |
| ADR-0038 | [phase-7-operator-ui-depth-scope](ADR-0038-phase-7-operator-ui-depth-scope.md) |
| ADR-0039 | [phase-7-operator-ui-depth-complete](ADR-0039-phase-7-operator-ui-depth-complete.md) |
| ADR-0040 | [phase-8-verified-bearer-identity-hs256-scope](ADR-0040-phase-8-verified-bearer-identity-hs256-scope.md) |
| ADR-0041 | [phase-8-verified-bearer-identity-hs256-complete](ADR-0041-phase-8-verified-bearer-identity-hs256-complete.md) |
| ADR-0042 | [phase-9a-observability-scheduler-discovery-spec-catalog](ADR-0042-phase-9a-observability-scheduler-discovery-spec-catalog.md) |
| ADR-0043 | [phase-9b-stacked-pr-delivery](ADR-0043-phase-9b-stacked-pr-delivery.md) |
| ADR-0044 | [phase-9b-observability-scheduler-discovery-runtime-complete](ADR-0044-phase-9b-observability-scheduler-discovery-runtime-complete.md) |
| ADR-0045 | [operational-readiness-v1-definition](ADR-0045-operational-readiness-v1-definition.md) |
| ADR-0046 | [operator-ui-flowbite-tailwind](ADR-0046-operator-ui-flowbite-tailwind.md) |
| ADR-0047 | [operator-ui-charts-flowbite-plugin](ADR-0047-operator-ui-charts-flowbite-plugin.md) |

Regenerate from `scripts/generate_adrs.py --force` if filenames change.

## Status rollup

| Status | Baseline status |
| --- | --- |
| Accepted | 0001–0008, 0010, 0012, 0013, 0014, 0015, 0016, 0017, 0018, 0020, 0021, 0022, 0023, 0024, 0025, 0026, 0027, 0028, 0029, 0031, 0032, 0033, 0034, 0035, 0036, 0037, 0038, 0039, 0040, 0041, 0042, 0043, 0044, 0046, 0047 (0043: Phase 9b stacked PR plan; 0044: Phase 9b runtime closure; 0046: Flowbite Svelte v2 + Tailwind v4 stack; 0047: data charts via Flowbite Svelte chart plugin + bespoke SVG where appropriate). |
| Proposed | 0045 (Operational Readiness v1 — definition and sequencing) |
| Deferred (owner + due-date) | 0011 (Nebula Sync specifics, Phase 4); 0030 (Kea Fabric state replication, Phase 3 prototype-comparison) |
| Future-Considered / Reserved | 0009, 0019, plus alternate paths: remote plugin-catalog distribution (from 0013) and continuous nightly release channel (from 0020) |
