# Pi-hole HA control plane — Phase 2 DNS / Pi-hole write risk (spec §7 Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the design’s **Phase 2** gate: **Pi-hole/DNS write paths (if any) with explicit risk review** (`docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §7). This plan **lands the ADR and traceability first**; code changes happen **only** if the ADR selects an option that authorises a concrete write surface.

**Architecture:** **dns-fabric** holds the **normative decision** (`docs/adr/`). **`pihole-ha`** implements only what the ADR permits; GitOps + host scripts remain the default control plane for stack-changing operations until Phase 3 adds audit.

**Tech stack:** Markdown ADR (MADR), optional `pihole-ha` FastAPI routes only after **Accepted** write scope.

**Normative spec:** Design spec §7 Phase 2; §5.3 Pi-hole row (“write strategy deferred”).

---

## File map (this phase)

| Path | Responsibility |
|------|----------------|
| `docs/adr/ADR-0051-pihole-ha-control-plane-phase2-dns-writes.md` | **dns-fabric** — decision + validation |
| `docs/operations/control-plane-mutations.md` | **pihole-ha** — operator truth table: what is **not** done via HTTP |
| `platform/control-plane/app/routes/` | **pihole-ha** — **only if** ADR authorises specific `POST` routes |

---

### Task 1: Write and land ADR-0051 (decision record)

**Files:**

- Create: `docs/adr/ADR-0051-pihole-ha-control-plane-phase2-dns-writes.md`

- [ ] **Step 1: Create ADR file with full content**

Create `docs/adr/ADR-0051-pihole-ha-control-plane-phase2-dns-writes.md`:

```markdown
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
```

- [ ] **Step 2: Markdown + spell check (dns-fabric)**

```bash
cd /path/to/pi-fabric
bash scripts/check_markdownlint.sh
```

Expected: `Summary: 0 error(s)`.

- [ ] **Step 3: Commit (`dns-fabric`) with DCO**

```bash
git add docs/adr/ADR-0051-pihole-ha-control-plane-phase2-dns-writes.md
git commit -s -m "docs(adr): ADR-0051 Phase 2 Pi-hole write surface risk gate"
git push dns-fabric main
```

---

### Task 2: Operator “truth table” in `pihole-ha` (always, regardless of ADR outcome)

**Files:**

- Create: `docs/operations/control-plane-mutations.md`

- [ ] **Step 1: Create operator doc**

Minimum sections:

1. **Today:** `POST /v1/mutations/*` returns **403** without token, **501** with token (Phase 1 stubs).
2. **Stack changes:** still **`pihole-ha-refresh.sh`** / **`pihole-ha-upgrade.sh`** on the host (link `control-plane-ui.md`).
3. **After ADR-0051 Accepted:** paste a short table “HTTP route | allowed? | notes” filled from the ADR.

- [ ] **Step 2: Commit (`pihole-ha`)**

```bash
git add docs/operations/control-plane-mutations.md
git commit -s -m "docs(control-plane): document mutation truth table vs ADR-0051"
git push origin main
```

---

### Task 3: Implement write API **only if** ADR picks Option B or C

**Precondition:** `docs/adr/ADR-0051-...md` has **`status: Accepted`** and **Decision outcome** names **Option B** or **Option C** with a **single** allowlisted behaviour.

**Files (example for Option B — reload-only):**

- Modify: `platform/control-plane/app/routes/mutations.py`
- Modify: `tests/test_control_plane.py`
- Modify: `platform/control-plane/spec/openapi.json` (regenerate via Phase 1 export script after route change)

- [ ] **Step 1: Add failing test for new route shape**

Example (adjust names to match ADR):

```python
def test_reloaddns_requires_token(self) -> None:
    from fastapi.testclient import TestClient
    import main as main_mod
    with patch.dict(os.environ, {"CONTROL_PLANE_API_TOKEN": "t"}, clear=False):
        c = TestClient(main_mod.app)
        r = c.post("/v1/mutations/pihole-reload-dns")
    self.assertEqual(r.status_code, 403)
```

- [ ] **Step 2: Implement route to match ADR exactly** (minimal code; no generic exec).

- [ ] **Step 3: Run `unittest` + OpenAPI export** (see Phase 1 plan).

Expected: all **PASS**; OpenAPI file updated if routes changed.

- [ ] **Step 4: Commit (`pihole-ha`)**

```bash
git commit -s -m "feat(control-plane): Phase 2 write surface per ADR-0051"
```

If ADR selects **Option A**, **skip Task 3** and record in ADR validation that “no HTTP write routes shipped” is complete.

---

## Self-review (spec coverage)

| Spec §7 Phase 2 | Covered by |
|-----------------|------------|
| “if any” + risk review | ADR-0051 + human **Accepted** outcome |
| Writes tied to Pi-hole/DNS | Task 3 only when ADR names the exact surface |

---

**Plan complete and saved to** `docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-phase-2-dns-write-risk.md`.

**Execution options:**

1. **Subagent-driven (recommended)** — Task 1 (ADR) human gate, then Task 2, then optional Task 3.
2. **Inline execution** — single session with stop after ADR acceptance.

Which approach?
