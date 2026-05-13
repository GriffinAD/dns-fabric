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
| `pihole-ha` `platform/core/docker-compose.control-plane.override.yml` + `platform/control-plane/` | **Done (Task 2):** optional per-node service, env contract, published port — branch `feat/control-plane-stub` |
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

### Task 2: `pihole-ha` optional compose stack (Phase 1 stub) + traceability

**Goal:** Ship a **toggleable** per-node **control-plane** service in **`pihole-ha`** (one container: static shell + FastAPI stub + OpenAPI), wired into **`CORE_COMPOSE_FILES`** like dnscrypt, with operator docs and CI **`docker compose config`** coverage.

**Upstream (product runtime repo):**

- Branch (pushed): `https://github.com/GriffinAD/pihole-ha/tree/feat/control-plane-stub`
- Open a PR from that branch: `https://github.com/GriffinAD/pihole-ha/compare/feat/control-plane-stub`

**Notable paths in `pihole-ha`:**

- `platform/control-plane/Dockerfile` — image build
- `platform/control-plane/app/main.py` — `/health`, `/dashboard`, `/logs/catalog`; static `index.html`
- `platform/core/docker-compose.control-plane.override.yml` — `control-plane` service + host port
- `ops/lib/compose-core.sh` — append override when `CONTROL_PLANE_UI_ENABLED=1`
- `ops/install/preflight.sh` — port + file checks when enabled
- `docs/operations/control-plane-ui.md` — toggle, apply, smoke curls (links back to this repo’s **design spec**)

**Operator reminder:** `pihole-ha-upgrade.sh` still reconciles **`pihole`** / dnscrypt only; after enabling the control plane, use the **`docker compose build` / `up control-plane`** snippet in **`control-plane-ui.md`** until upgrade scripts include that service.

- [x] **Step 1:** Implement stub stack and docs in **`pihole-ha`** (see commit on `feat/control-plane-stub`).
- [x] **Step 2:** Push **`feat/control-plane-stub`** to **`origin`** on **`GriffinAD/pihole-ha`**.
- [x] **Step 3:** Record Task 2 in **this** plan file (`pi-fabric`) so **`pi-fabric`** stays the coordination anchor for design + plan.

---

**After Task 2:** Next slices are **live adapters** (Docker, VIP, Pi-hole read models), **`GET /logs/stream/{id}`** (SSE), and wiring **`pihole-ha-upgrade.sh`** to **`up`** **`control-plane`** when enabled — track as Task 3+ in this plan or a new dated plan when scope is locked.
