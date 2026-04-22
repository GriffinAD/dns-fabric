---
title: Configuration Architecture
tier: B
gate: 1
owner: GriffinAD
peer_reviewer: GriffinAD
status: Accepted
last_review: 2026-04-19
adrs: []
invariants: []
---

<!-- markdownlint-disable MD025 -->
# Configuration Architecture

## Scope

Defines config schema ownership, layering precedence, sensitive value handling,
and reload semantics (hot/restart/approval).

## Responsibilities

1. Define canonical config precedence order.
2. Enforce per-plugin schema ownership and namespace boundaries.
3. Resolve secrets through provider contracts, never plaintext leakage.
4. Classify config changes by reload requirement.

## Contracts consumed

| Contract | From | Notes |
| --- | --- | --- |
| Secret provider contract | `contracts.md` | `$secret://` resolution path. |
| Policy/approval workflow | `security.md` | Approval-tagged reload class. |

## Contracts published

| Contract | Artefact | Notes |
| --- | --- | --- |
| Config schema bundle | `specs/config/` (planned) | Core + plugin JSON Schemas. |
| Reload classification map | `specs/config/reload-tags.json` (planned) | hot/restart/approval tagging. |

## Invariants

None declared yet; schema ownership invariants to be indexed later.

## Failure modes

- Invalid schema merge -> startup/config reload reject with diagnostics.
- Missing secret reference -> fail closed for dependent subsystem.
- Unauthorized runtime override -> denied + audited.
- Cross-namespace plugin key injection -> validation failure.

```mermaid
flowchart LR
    D[Package defaults] --> M[Merge pipeline]
    S[/etc/kea-fabric/*.yaml] --> M
    U[XDG/user config] --> M
    E[Env KEA_FABRIC_*] --> M
    C[CLI flags] --> M
    M --> V[Schema + policy validation]
    V --> R[Runtime config state]
```

## Cross-refs

- `principles.md`
- `overview.md`
- `invariants.md`
- `security.md`
- `api.md`
- `data.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial configuration architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Gate 1 Tier B (core) acceptance. |
