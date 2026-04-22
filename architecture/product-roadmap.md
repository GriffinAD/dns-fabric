---
title: Product roadmap and Operational Readiness v1
tier: C
gate: Rolling
owner: GriffinAD
peer_reviewer: GriffinAD
status: Accepted
last_review: 2026-04-21
adrs: [ADR-0045]
invariants: []
---

<!-- markdownlint-disable MD025 -->
# Product roadmap and Operational Readiness v1

## Scope

This Tier C document bridges **closed programme phases** (see `../../AGENTS.md`
and `../adr/README.md`) and **mission-level** expectations (live Kea control,
Nebula runtime, remote marketplace, full identity programmes). It records the
**critical path** toward **Operational Readiness v1**, which is normatively
defined in **`ADR-0045`**.

It does not replace subsystem architecture; it sequences work and names exit
criteria that span multiple Tier B/C documents.

## Acceptance criteria for Rolling close

- [x] Operational Readiness v1 is delegated to a single ADR (`ADR-0045`).
- [x] Gap matrix and sequencing reference the authoritative subsystem docs.
- [x] Explicit boundary between v1 scope and deferred / future-considered ADRs.

## Where we are (post Phase 9b)

The **stacked phase programme** through **Phase 9b** is **complete** for its
declared scope (`ADR-0042`–`ADR-0044`): spec catalogues, scheduler and discovery
hosts with audited wiring, observability catalog alignment, UI operator shell
depth through Phase 7, optional HS256 bearer verification (Phase 8), packaging
and durable events (Phase 5), reference plugins and HTTP Kea Control Agent
wiring at the **integration seam** (Phase 4).

That baseline is **not** the same as “every operator mission is satisfied out
of the box”: deeper **live Kea** behaviour, **deployment proof** in realistic
topologies, **OIDC-first** identity (beyond optional HS256), **Nebula Sync**
runtime details (`ADR-0011`), **Fabric state replication** (`ADR-0030`), and
**remote marketplace** distribution remain **out of scope** for v1 unless
pulled in by `ADR-0045` acceptance.

## Gap matrix (summary)

| Area | Current baseline | Typical “mission” gap | Primary refs |
| --- | --- | --- | --- |
| Kea | CA wiring + reference plugins; stub/live seams | Policy-rich lifecycle, HA/failover stories, production-grade error surfaces | `kea-integration.md`, `ADR-0035` |
| Deploy / operate | Docs + CI gates | Repeatable install smoke, upgrade/rollback runbooks, env-specific config matrix | `deployment.md`, `packaging.md`, `platform-support.md` |
| Identity | Optional HS256 + legacy bearer-present | OIDC as primary, break-glass local, rotation | `security.md`, `ADR-0007`, `ADR-0040`, `ADR-0041` |
| Nebula / replication | Observe-only fencing, deferred sync specifics | Authoritative sync + replication choice | `nebula-sync.md`, `ADR-0011`, `ADR-0030` |
| Marketplace | Local operator drop | Remote catalog, signing (future ADRs) | `marketplace.md`, `ADR-0013`, `ADR-0009` |
| Contracts / API surface | Conformance harness + specs | OpenAPI completeness, E2E parity with operator workflows | `contracts.md`, `api.md`, `testing.md` |

## Sequencing toward Operational Readiness v1

Order follows **risk reduction** and **falsifiable operator value**; details and
acceptance tests live in **`ADR-0045`**.

1. **Kea depth** — narrow the gap between “integration seam” and operator-trust
   worthy control and diagnostics (see `kea-integration.md`).
2. **Deployment proof** — documented path from artifact to running fabric plus
   smoke checks (`deployment.md`, `AGENTS.md` validation commands).
3. **Identity (optional for v1)** — if v1 includes multi-tenant or external IdP,
   track against `ADR-0007`; otherwise document “HS256-only v1” explicitly in
   `ADR-0045`.
4. **Nebula / replication** — only when `ADR-0011` / `ADR-0030` re-enter scope;
   until then treat as **explicit deferral** in release notes.
5. **Marketplace at scale** — after local lifecycle is field-proven; aligns
   with `marketplace.md` and reserved signing ADRs.

## Dashboard composition pointer

Dashboard editor composition and plugin-based UI surface contracts for the
operator shell are defined in `dashboard-plugin-blueprint.md`. This roadmap doc
tracks sequencing; it does not replace that architecture-level contract source.

## Cross-refs

- `../../AGENTS.md`
- `../adr/README.md`
- `ADR-0045` — Operational Readiness v1 (normative checklist)
- `kea-integration.md`, `deployment.md`, `security.md`, `marketplace.md`
- `dashboard-plugin-blueprint.md`
- `nebula-sync.md`, `future-considerations.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-20 | Accepted | GriffinAD | Initial Tier C roadmap; delegates v1 DoD to ADR-0045. |
| 2026-04-21 | Accepted | GriffinAD | Added pointer to `dashboard-plugin-blueprint.md` for dashboard editor/plugin composition contracts. |
