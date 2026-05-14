---
title: "ADR-0051: Pi-hole HA control plane Phase 2 — DNS / Pi-hole HTTP write surface"
adr: "0051"
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
  - docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md
---

# ADR-0051: Pi-hole HA control plane Phase 2 — DNS / Pi-hole HTTP write surface

## Status

`Accepted` — **Option A** recorded below. No HTTP-mediated **writes** to Pi-hole or
DNS **configuration** are exposed from the control plane under this decision.
**ADR-0052** governs separate **mutation** endpoints that **defer** to host scripts
(**202**); they do **not** change Pi-hole/DNS config files from the container and
are out of scope for Phase 2 “write surface”.

## Context

The per-node control plane (`pihole-ha` `platform/control-plane/`) is **read-first** (design spec §5.3, §6.1). Phase 2 asks whether **any** HTTP-mediated **writes** to Pi-hole / DNS configuration are exposed from the container, and demands **explicit risk review** before doing so.

Forces:

- Pi-hole config lives on the host bind mount; wrong writes break DNS for the LAN.
- The container already has **read-only** `docker.sock` and can **`docker exec`**; writes via exec are still **high risk** without audit (Phase 3).
- Operational truth remains **Git + refresh scripts** (design §2.1).

## Decision drivers

- Safety vs operator convenience.
- Alignment with Phase 3 (**auth + audit**) if any write surface is approved early.

## Considered options

1. **Option A — Defer all HTTP writes** until Phase 3 supplies **auth + audit**; Phase 2 delivers **hazard analysis + operator docs only**.
2. **Option B — Narrow read-only “write”** that triggers **idempotent reload only** (e.g. `pihole reloaddns` via `docker exec`) **without** changing disk config — still requires Phase 3 token if exposed as HTTP.
3. **Option C — Documented HTTP write** to a **specific** allowlisted file or API (e.g. upstream list) with rollback and tests — **only** if paired with Phase 3 controls in the same release train.

## Decision outcome

**Chosen option: Option A** — **No** HTTP routes that **write** Pi-hole or DNS
configuration from the control plane. Stack-changing operations remain **host
GitOps + `pihole-ha-refresh.sh` / `pihole-ha-upgrade.sh`**.

Re-opening Phase 2 scope (Option B or C) requires a **new ADR revision** or
superseding ADR with explicit allowlist, tests, and hazard sign-off.

### Positive consequences

- Smallest LAN attack surface for DNS-breaking mistakes.
- Clear separation: Phase 2 “writes” question is **closed** without shipping risky APIs.

### Negative consequences

- Operators cannot drive Pi-hole/DNS **disk** changes through this HTTP API; host workflows only.

## Validation

- ADR **`Accepted`** with **Option A** recorded — satisfied.
- **`pihole-ha`** `docs/operations/control-plane-mutations.md` lists forbidden vs allowed HTTP actions matching this ADR — operator truth table updated on acceptance.
- **Option B/C:** not selected; no additional contract tests required for disallowed write routes.

## Pros and cons of the options

### Option A

- ✅ Lowest risk; matches home-LAN deployment reality.
- ❌ No HTTP convenience for Pi-hole/DNS file edits.

### Option B

- ✅ Could offer safe reload-only automation when paired with audit.
- ❌ Not selected; would need new acceptance cycle.

### Option C

- ✅ Could unlock specific allowlisted edits when fully specified.
- ❌ Not selected; highest review burden.

## Links

- Spec: `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §7 Phase 2
- Phase 3 ADR: `docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md`
- Phase 3 plan: `docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-phase-3-mutations-audit.md`

## Change Log

| Date | Status | Reviewer | Notes |
|---|---|---|---|
| 2026-05-13 | Proposed | GriffinAD | Initial draft. |
| 2026-05-14 | Accepted | GriffinAD | Option A: no Pi-hole/DNS HTTP write surface; truth table updated in `pihole-ha`. |
