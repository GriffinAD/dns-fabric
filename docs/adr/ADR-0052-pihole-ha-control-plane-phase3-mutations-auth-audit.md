---
title: "ADR-0052: Pi-hole HA control plane Phase 3 — mutations, authentication, and audit"
adr: "0052"
status: Accepted
date: 2026-05-13
owner: GriffinAD
peer_reviewer: GriffinAD
deciders: [GriffinAD]
due_date: null
re_entry_criteria: null
touch_points:
  - GriffinAD/pihole-ha
  - GriffinAD/dns-fabric
  - docs/adr/ADR-0051-pihole-ha-control-plane-phase2-dns-writes.md
---

# ADR-0052: Pi-hole HA control plane Phase 3 — mutations, authentication, and audit

> MADR format. Every ADR lives in `docs/adr/` and is referenced by the
> architecture docs whose design depends on it.

## Status

`Accepted` — Phase 3 policy locked; **`pihole-ha`** implements auditable mutations and
**202** host-deferred responses per **Decision outcome** below.

## Context

Phase 3 introduces authenticated, auditable mutation paths for the per-node
control plane while keeping GitOps and host scripts as the source of truth
unless this ADR explicitly expands HTTP scope. Phase 2 (`ADR-0051`) gates any
DNS/Pi-hole write surface; this ADR records how Phase 3 layers **auth** and
**audit** on top when mutations are enabled.

## Decision drivers

- Prevent unauthenticated or unaudited configuration changes from the LAN.
- Avoid a generic “run command” API; every action must be explicit and testable.
- Keep operator ergonomics aligned with documented host workflows when HTTP is
  not the right control.

## Considered options

1. **Option A** — Bearer/`X-Api-Token` plus append-only JSONL audit and strict
   route allowlists only (no DNSCrypt over HTTP in the first acceptance).
2. **Option B** — Same as Option A but add selected HTTP-triggered `docker exec`
   actions per route with matching audit lines.
3. **Option C** — Same as Option A/B plus HTTP-mediated DNSCrypt toggles with
   expanded review and rollback documentation.

## Decision outcome

**Chosen option: Option A** (minimal HTTP attack surface) with **202** responses
that defer DNSCrypt and full-stack refresh to **host `.env` + documented scripts**
(no HTTP-mediated DNSCrypt toggle until this ADR is revised).

Concrete policy:

- **Authentication:** reuse **`CONTROL_PLANE_API_TOKEN`**; reject missing or
  invalid tokens with **403** and **do not echo** secrets or token material in
  responses.
- **Audit:** every mutation attempt appends one JSON object line to
  **`CONTROL_PLANE_AUDIT_LOG`**, a path inside the container backed by a
  **host file** mount (append-only from the application’s perspective).
- **Authorisation:** mutations are **allowlisted by route name**; there is **no**
  generic command or shell channel over HTTP.
- **DNSCrypt policy:** **not via HTTP until this ADR is revised** — operators use
  host `.env` and the documented refresh scripts instead of an HTTP toggle in
  the initial Phase 3 scope.

### Positive consequences

- Clear, reviewable security story: token + file audit + fixed route surface.
- Fail-closed defaults remain compatible with Phase 2 Option A deferrals.

### Negative consequences

- Some operator actions stay on the host (extra steps vs a single HTTP click).
- Audit volume and host mount path must be operated deliberately.

## Validation

- With **`status: Accepted`**, `pihole-ha` contract tests cover allowlisted
  routes, **403** without token leakage, and audit lines for success and
  expected failure paths.
- `docs/operations/control-plane-mutations.md` matches the allowlist described
  here.

## Pros and cons of the options

### Option A

- ✅ Minimal HTTP attack surface; strongest default for home/LAN deployments.
- ❌ Does not move every host-only workflow behind HTTP.

### Option B

- ✅ Can automate a small set of audited, idempotent exec-backed actions.
- ❌ Each new exec path needs hazard analysis and tests.

### Option C

- ✅ Maximum operator convenience for DNSCrypt from the UI/API.
- ❌ Highest review burden; easy to get wrong without strong rollback and tests.

## Links

- Related ADRs: `docs/adr/ADR-0051-pihole-ha-control-plane-phase2-dns-writes.md`
- Related docs: `docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-phase-3-mutations-audit.md`
- Related specs: `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §7 Phase 3

## Change Log

| Date | Status | Reviewer | Notes |
|---|---|---|---|
| 2026-05-13 | Proposed | GriffinAD | Initial draft from Phase 3 plan Task 1 bullets. |
| 2026-05-14 | Accepted | GriffinAD | Option A + 202 host-deferred mutations; audit mount path as implemented in `pihole-ha`. |
