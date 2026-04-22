---
title: Future Considerations
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
# Future Considerations

## Scope

Canonical backlog for deferred or reserved architecture items, with rationale,
re-entry criteria, and touchpoint mapping.

## Acceptance criteria for Rolling close

- [ ] Deferred/reserved items catalogued with rationale.
- [ ] Re-entry criteria defined per item.
- [ ] Affected docs/ADRs listed per item.
- [ ] Review cadence and ownership documented.

## Adjacent operator surfaces (not in `/api/v1`)

**Pi-hole** (optional, separate client): REST + JSON patterns and version-specific interactive docs are useful for DNS-adjacent or lab workflows alongside DHCP. These are **not** part of Kea Fabric’s canonical operator contract in [`specs/api/openapi.yaml`](../specs/api/openapi.yaml).

| Resource | URL | Notes |
| --- | --- | --- |
| Pi-hole API (published) | [docs.pi-hole.net/api](https://docs.pi-hole.net/api/#accessing-the-api-documentation) | Auth, verbs, structured errors (`key` / `message` / `hint`). |
| Pi-hole API docs (local install) | [http://pi.hole/api/docs/](http://pi.hole/api/docs/) | Matches the running Pi-hole version; use for prototyping against a real host (hostname may differ). |

## Current reserved themes

- Signing/provenance pipeline.
- Expanded plugin distribution models.
- Additional release channel options.
- Advanced fencing/failover options.

## Cross-refs

- `../adr/README.md`
- `release-process.md`
- `marketplace.md`
- `cicd.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C future-considerations draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
