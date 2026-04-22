---
title: Peer-Reviewer Protocol
owner: GriffinAD
peer_reviewer: GriffinAD
status: Accepted
last_review: 2026-04-19
---

# Peer-Reviewer Protocol

Every Tier A and Tier B doc has **two names on its frontmatter**: the `owner`
(who writes) and the `peer_reviewer` (who signs off before `status` flips to
`Accepted`). This document defines the pairing rule, the review checklist, the
roster, the escalation path, and the Change Log convention.

## Pairing rule

- Every Tier A and Tier B doc MUST declare both `owner` and `peer_reviewer` in
  its frontmatter.
- **`owner` and `peer_reviewer` SHOULD be different people.** When a single
  maintainer holds both (solo phase), both fields MAY list the same name; status
  flips to `Accepted` use **self-review**: the Change Log names that person as
  reviewer and the checklist in this document still applies as a quality bar.
- Tier C docs SHOULD declare a peer reviewer but MAY be reviewed by the owner
  plus one ad-hoc reviewer captured only in the Change Log.
- Status cannot flip from `Proposed` to `Accepted` without a Change Log entry
  that names the reviewer and the review date.

## Review checklist (12 items)

The peer reviewer must verify, before approving a status flip to `Accepted`:

1. Every `INV-<AREA>-<NAME>` invariant referenced in the doc is indexed in
   `docs/architecture/invariants.md`.
2. All `INV-*` IDs are unique across the repo.
3. All cross-references (to other docs, ADRs, specs) resolve.
4. Every ADR cited has a consistent status and is not in a forbidden state
   for the citation (e.g. no `Accepted` doc that depends on a `Deferred` ADR
   without also calling that out).
5. No unassigned placeholder markers in any section of an `Accepted` doc (Change Log excepted).
6. Every citation of material under `REF_ONLY/` carries a mandatory `Delta:`
   field stating what changed versus the source and why.
7. Every contract named in the doc has a machine-readable artefact under
   `specs/` (JSON Schema, OpenAPI, or Protocol stub).
8. Frontmatter is complete: `title`, `tier`, `owner`, `peer_reviewer`,
   `status`, `last_review`, `adrs`, `invariants`.
9. A Change Log entry exists for this revision, naming the peer reviewer.
10. No contradictions with sibling docs (spot-check at minimum; full matrix
    review for Tier A).
11. Mermaid diagrams render; markdownlint and cspell run clean.
12. External links: CI runs **lychee** in **advisory** mode (reports issues;
    does not fail the workflow). Reviewers still spot-check critical links.

## Reviewer roster

Placeholder. Filled in as contributors are assigned. One row per Tier A and
Tier B doc; Tier C rows added as those docs enter Rolling.

| Doc | Owner | Peer Reviewer | Last Review Date |
|---|---|---|---|
| `docs/architecture/README.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/glossary.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/principles.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/overview.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/invariants.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/threat-model.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/DOC_STANDARDS.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/reference-ledger.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/core-runtime.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/plugins.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/contracts.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/events.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/api.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/ui.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/security.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/observability.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/marketplace.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/kea-integration.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/nebula-sync.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/scheduler.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/discovery.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/data.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/config.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/brokers.md` | GriffinAD | GriffinAD | 2026-04-19 |

### Tier C (Rolling)

| Doc | Owner | Peer Reviewer | Last Review Date |
|---|---|---|---|
| `docs/architecture/cicd.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/concurrency-model.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/data-governance.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/deployment.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/error-taxonomy.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/future-considerations.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/i18n.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/packaging.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/performance.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/platform-support.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/release-process.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/testing.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/ui-assets.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/ui-design-system.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/ui-fonts.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/ui-icons.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/ui-themes.md` | GriffinAD | GriffinAD | 2026-04-19 |
| `docs/architecture/versioning.md` | GriffinAD | GriffinAD | 2026-04-19 |

## Escalation

If owner and peer reviewer cannot converge, the ADR that governs the disputed
decision is **re-opened** (status flipped back to `Proposed`) and the question
escalates to the architecture review. The architecture review's meta-owner is
the project lead; their call is final and is recorded as the ADR's Change Log
entry.

## Change Log convention

Every status flip MUST write a Change Log entry using this exact shape:

```
YYYY-MM-DD  status: <new-status>  reviewer: <name>  notes: <one line>
```

Example:

```
2026-05-03  status: Accepted  reviewer: a.turing  notes: Invariants indexed; contracts in specs/; Mermaid validated.
```

Pre-`Accepted` revisions may append lightweight entries (typos, rewordings) that
do not require a fresh review, provided the Change Log says so explicitly:

```
2026-05-04  status: Accepted  reviewer: (no-op)  notes: Typo fix only, no content change.
```

## Change Log

| Date | Status | Reviewer | Notes |
|---|---|---|---|
| 2026-04-19 | Accepted | GriffinAD | Initial protocol; roster stubs only. |
| 2026-04-19 | Accepted | GriffinAD | Solo maintainer: owner and peer_reviewer both GriffinAD; self-review allowed. |
| 2026-04-19 | Accepted | GriffinAD | Roster: Tier A Gate 1 docs accepted; last-review dates for index, glossary, principles, overview, invariants, threat-model, DOC_STANDARDS, reference-ledger. |
| 2026-04-19 | Accepted | GriffinAD | Roster: Gate 1 Tier B core set accepted (core-runtime through brokers, plus kea-integration). |
| 2026-04-19 | Accepted | GriffinAD | Roster: Gate 2 Tier B + full Tier C architecture set accepted; Tier C table added. |
| 2026-04-19 | Accepted | GriffinAD | Checklist item 12: advisory lychee link pass; reviewers still spot-check critical links. |
