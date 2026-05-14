# Pi-hole HA control plane — Phase 4 aggregation / centralisation (spec §7 Phase 4, optional)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the **optional** design **Phase 4**: **centralisation or peer aggregation only if requirements re-open Section 1** (`docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §7). Today Section 1 still selects **per-node** placement (design §4); **no runtime work ships** until product requirements explicitly reopen topology.

**Architecture:** This phase is **requirements + ADR only** in **`dns-fabric`**. Any future implementation would be a **new service** or **federated read** pattern — **out of scope** for the current single-container `pihole-ha` image unless a later ADR supersedes packaging §3.1.

**Tech stack:** Markdown ADR, optional sequence diagrams in docs.

**Normative spec:** Design §7 Phase 4; §4 “no follow-the-VIP” (v1).

## Relationship to `2026-05-13-pihole-ha-control-plane-ui.md` (bootstrap plan)

That bootstrap plan’s **Tasks 2–5** established **per-node** control plane (design §4 Option A). **Phase 4** is **explicitly out of scope** until Section 1 topology is reopened; this file does not alter bootstrap deliverables.

---

## File map (this phase)

| Path | Responsibility |
|------|----------------|
| `docs/adr/ADR-0053-pihole-ha-control-plane-phase4-aggregation-reserved.md` | **dns-fabric** — **Future-Considered/Reserved** gate |
| `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` | Cross-link to ADR-0053 from §7 (small edit, optional) |

---

### Task 1: ADR-0053 (reserved / re-entry criteria)

**Files:**

- Create: `docs/adr/ADR-0053-pihole-ha-control-plane-phase4-aggregation-reserved.md`

- [ ] **Step 1: Create ADR with `status: Future-Considered/Reserved`**

Use `docs/_templates/ADR_TEMPLATE.md`. Required fields:

```yaml
status: Future-Considered/Reserved
re_entry_criteria: >
  Phase 4 implementation may start only when all are true:
  (1) product owner accepts loss of strict per-node locality OR defines
  a read-only aggregator with explicit data classes; (2) threat model
  for cross-node credentials is written; (3) Phase 3 audit pattern is
  production-proven on both nodes for at least one release.
touch_points:
  - docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md §1 topology
  - GriffinAD/pihole-ha control-plane packaging ADR (future)
```

Body must state **no shipping code** under current spec.

- [ ] **Step 2: Lint + commit (`dns-fabric`)**

```bash
bash scripts/check_markdownlint.sh
git add docs/adr/ADR-0053-pihole-ha-control-plane-phase4-aggregation-reserved.md
git commit -s -m "docs(adr): ADR-0053 reserve Phase 4 aggregation work"
git push dns-fabric main
```

---

### Task 2: Optional spec cross-link

**Files:**

- Modify: `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md`

- [ ] **Step 1: Under §7 table, add one sentence**

> “Phase 4 execution is gated by **ADR-0053**; see `docs/adr/ADR-0053-pihole-ha-control-plane-phase4-aggregation-reserved.md`.”

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md
git commit -s -m "docs(spec): link Phase 4 to ADR-0053 gate"
git push dns-fabric main
```

---

### Task 3: When re-entry criteria are met (placeholder forbidden — use this checklist instead)

Do **not** start coding until ADR-0053 is moved to **`Proposed`** with a concrete topology choice. Then **open a new dated implementation plan** (do not overload this file); minimum contents of that future plan’s Task 1:

1. Choose aggregator placement (third host vs VIP follower vs peer pull).
2. Define **read-only** API contract first; mutations remain on-node unless ADR supersedes.
3. Add threat model doc path.

---

## Self-review (spec coverage)

| Spec §7 Phase 4 | Covered by |
|-----------------|------------|
| Optional / only if Section 1 reopens | ADR-0053 **Reserved** + re-entry criteria |
| No accidental centralisation | Task 3 forbids coding until ADR state change |

---

**Plan complete and saved to** `docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-phase-4-aggregation-optional.md`.

**Execution options:**

1. **Subagent-driven (recommended)** — Task 1–2 only; Task 3 is a future plan.
2. **Inline execution**

Which approach?
