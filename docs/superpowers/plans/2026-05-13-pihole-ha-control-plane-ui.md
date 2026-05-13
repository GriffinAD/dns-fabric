# Pi-hole HA control plane UI — implementation plan (bootstrap)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the approved **design specification** and a **bootstrap implementation plan** in this repository so Phase 1 runtime work can proceed in `pihole-ha` and/or `pi-fabric` with a single source of truth.

**Architecture:** Per-node **one container** serving **static UI + OpenAPI HTTP API** (see `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §3.1). Runtime compose and adapters live primarily under **`pihole-ha`**; **`pi-fabric`** contributes patterns (OpenAPI, dashboard shell, SSE) per the design §5.4.

**Tech stack (Phase 1 runtime, forward reference):** Docker Compose on Debian/Raspberry Pi OS; Python API (FastAPI or equivalent already used in `pi-fabric`); static SPA build from `apps/ui` or a slim fork; SSE for log streams.

---

## File map (Phase 1+, forward reference)

| Location | Responsibility |
|----------|------------------|
| `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` | Normative design (committed in Task 1) |
| `pihole-ha` `platform/core/docker-compose.yml` (or new compose fragment) | New **per-node** service definition, env contract, published port |
| `pihole-ha` ops smoke / install docs | Documented curl/SSE smoke for `/dashboard`, `/logs/catalog` |
| `pi-fabric` `src/kea_fabric/` (or new package) | Reusable API + static mount pattern **only if** code is shared here; otherwise adapters stay in `pihole-ha` image source |

---

### Task 1: Land design spec and bootstrap plan on a short-lived docs branch

**Files:**

- Present (commit): `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md`
- Create (commit): `docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-ui.md` (this file)

- [ ] **Step 1: Confirm markdown**

Run:

```bash
cd /Volumes/Data/piHole/pi-fabric
bash scripts/check_markdownlint.sh
```

Expected: `Summary: 0 error(s)`

- [ ] **Step 2: Confirm repo-local Git identity**

Run:

```bash
test "$(git config --local user.name)" = "GriffinAD"
test "$(git config --local user.email)" = "nigel.surridge@btinternet.com"
```

Expected: both succeed (exit code 0).

- [ ] **Step 3: Create a branch off current `main`**

Run:

```bash
git checkout -b docs/pihole-ha-control-plane-ui
```

Expected: branch created; working tree includes the spec and this plan file as tracked or staged changes.

- [ ] **Stage artifacts**

Run:

```bash
git add docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md
git add docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-ui.md
git status
```

Expected: `Changes to be committed` lists both paths.

- [ ] **Step 4: Commit with DCO sign-off**

Run:

```bash
git commit -s -m "docs: add Pi-hole HA control plane UI design and plan"
```

Expected: commit created; message ends with `Signed-off-by: GriffinAD <nigel.surridge@btinternet.com>`.

---

**After Task 1:** Phase 1 **runtime** tasks (Compose service, Dockerfile, adapters, UI build) belong in a **follow-up plan** once the target repo (`pihole-ha` vs `pi-fabric` split) and image layout are chosen; do not block Task 1 on that split.
