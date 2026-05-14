---
title: "ADR-0051: Pi-hole HA control plane Phase 2 — DNS / Pi-hole HTTP write surface"
adr: "0051"
status: Proposed
date: 2026-05-13
owner: GriffinAD
peer_reviewer: GriffinAD
deciders: []
due_date: null
re_entry_criteria: null
touch_points:
  - GriffinAD/pihole-ha
  - GriffinAD/dns-fabric
---

# ADR-0051: Pi-hole HA control plane Phase 2 — DNS / Pi-hole HTTP write surface

## Status

`Proposed` — requires human acceptance before any **`pihole-ha`** write API ships.

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

**Human must record the chosen option here before implementation tasks proceed.**

Default recommendation for operators: **Option A** until Phase 3 is accepted.

### Validation

- ADR **`Accepted`** with chosen option recorded.
- **`pihole-ha`** `docs/operations/control-plane-mutations.md` lists forbidden vs allowed HTTP actions matching the ADR.
- If Option B/C: contract tests prove **no path outside allowlist** and **no unauthenticated** route.

## Links

- Spec: `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §7 Phase 2
- Phase 3 plan: `docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-phase-3-mutations-audit.md`
