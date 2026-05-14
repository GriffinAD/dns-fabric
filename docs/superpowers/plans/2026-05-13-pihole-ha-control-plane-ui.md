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
| `pihole-ha` `platform/core/docker-compose.control-plane.override.yml` + `platform/control-plane/` | **Done (Tasks 2–5):** optional per-node service on **`pihole-ha`** **`main`** (merged from `feat/control-plane-stub`; tip includes **`ecdcaf7`**) |
| `pihole-ha` ops smoke / install docs | **`/dashboard`**, **`/logs/catalog`**, SSE curl examples in **`docs/operations/control-plane-ui.md`** (Task 3) |
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

- **Merged to `main`:** `https://github.com/GriffinAD/pihole-ha` (control-plane work landed via **`feat/control-plane-stub`**; branch may still exist for cleanup only).

**Notable paths in `pihole-ha`:**

- `platform/control-plane/Dockerfile` — image build
- `platform/control-plane/app/main.py` — `/health`, `/dashboard`, `/logs/catalog`; static `index.html`
- `platform/core/docker-compose.control-plane.override.yml` — `control-plane` service + host port
- `ops/lib/compose-core.sh` — append override when `CONTROL_PLANE_UI_ENABLED=1`; **`pihole_ha_docker_compose_up_core_stack`** builds + `up`s **`control-plane`** with **`pihole`** on refresh/upgrade/bootstrap/DHCP reconcile paths
- `ops/install/preflight.sh` — port + file checks when enabled
- `docs/operations/control-plane-ui.md` — toggle, apply, smoke curls (links back to this repo’s **design spec**)

**Operator reminder:** disabling **`CONTROL_PLANE_UI_ENABLED`** removes the override from **`CORE_COMPOSE_FILES`**; an already-running **`control-plane`** container may remain until you **`docker compose … rm -f control-plane`** (or **`down`**) with the previous file list — document a clean disable path later if needed.

- [x] **Step 1:** Implement stub stack and docs in **`pihole-ha`** (see commit on `feat/control-plane-stub`).
- [x] **Step 2:** Push **`feat/control-plane-stub`** to **`origin`** on **`GriffinAD/pihole-ha`**.
- [x] **Step 3:** Record Task 2 in **this** plan file (**dns-fabric**) so design + plan stay anchored here.
- [x] **Step 4:** Wire **`pihole_ha_docker_compose_up_core_stack`** through refresh/upgrade/bootstrap/DHCP reconcile (see **`pihole-ha`** commit **`ebbc3f7`** on the same branch).

---

### Task 3: Docker read model + log catalogue + SSE (Phase 1)

**Goal:** **`/dashboard`** exposes a **Docker** section (watched containers). **`/logs/catalog`** lists allowlisted streams; **`GET /logs/stream/{id}`** tails Docker logs over **SSE**. Control-plane mounts **`/var/run/docker.sock`** read-only.

**`pihole-ha`:** branch **`feat/control-plane-stub`**, commits **`fab68ad`**, **`9a5f5c8`** (and earlier **`ebbc3f7`** for compose helper).

- [x] **Step 1:** Docker SDK + socket mount + `adapters/docker_state.py` + dashboard `sections.docker`.
- [x] **Step 2:** `logs/catalog.py` + SSE stream route + `tests/test_control_plane.py`.
- [x] **Step 3:** Preflight **WARN** when toggle on but **`docker.sock`** missing; operator doc updates.

---

### Task 4: HA / Pi-hole config / stack dashboard + static UI

**Goal:** **`/dashboard`** adds **`sections.ha`** (from compose-injected `.env`), **`pihole_dns`** (read-only **`pihole.toml`** via **`/ro/pihole-etc`** bind), **`stack`** (Nebula/DNSCrypt/Kea rows + Nebula **`CRON`** from inspect), **`keepalived`** placeholder; ship **`/dashboard.html`** operator console.

**`pihole-ha`:** branch **`feat/control-plane-stub`**, commits **`7135a9f`**, **`f87ba04`**.

- [x] **Step 1:** Compose env passthrough + Pi-hole **`etc-pihole`** read-only mount + **`extra_hosts`**.
- [x] **Step 2:** Python sections + **`dashboard.build_dashboard`**; static **`dashboard.html`**.
- [x] **Step 3:** Tests, preflight dir warn, CI **`mkdir`** for compose validate; operator doc refresh.

---

### Task 5: Phase 1 read-path completion (parallel dashboard, Kea + maintenance binds, VIP probe, schedules, DNSCrypt section, mutation stubs, file SSE)

**Goal:** Finish the Phase 1 items deferred after Task 4: **`widgets`** on **`GET /dashboard`**, parallel section assembly with bounded waits, **`sections.pihole_runtime`**, **`sections.kea_dhcp`** (read-only JSON), **`sections.schedules`**, **`sections.dnscrypt`**, **`sections.keepalived`** VIP TCP probe + LAN hint (still not full VRRP), **`GET /v1/meta`**, **`POST /v1/mutations/*`** stubs (**403** / **501**), optional **file** log stream + catalogue entry, shared Docker client for stack inspect + dashboard, compose binds for **`/ro/kea-etc`** and maintenance log, preflight **`mkdir`/`touch`** for log path.

**`pihole-ha`:** merged to **`main`** (includes commit **`ecdcaf7`** from **`feat/control-plane-stub`**).

- [x] **Step 1:** Adapters + sections + dashboard parallel merge + **`CONTROL_PLANE_VERSION` 0.4.0**.
- [x] **Step 2:** Compose volumes + env (`CONTROL_PLANE_MAINTENANCE_LOG`, `CONTROL_PLANE_API_TOKEN`) + preflight host file ensure + CI **`pip`** test deps + compose validate **`mkdir`** / **`touch`**.
- [x] **Step 3:** Unit tests (`TestClient` for mutations/meta), operator doc refresh, static **`dashboard.html`** widgets panel.

---

## Phase 2+ roadmap (forward reference — not numbered tasks in this bootstrap plan)

**Phase 1 in this file** = **Tasks 2–5** above (**complete** on **`pihole-ha`** **`main`**). Normative **phase names 2–4** and boundaries live in the design spec **§7 — Phased delivery** (`docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md`).

| Design phase | What it means (spec §7) |
|--------------|-------------------------|
| **2** | Pi-hole / DNS **write** paths (if any) with explicit **risk review**. |
| **3** | DNSCrypt and refresh-script-class **mutations** with **authentication + audit** (replaces today’s **`POST /v1/mutations/*`** **403/501** stubs in **`pihole-ha`**). |
| **4** | Optional **centralisation** or **peer aggregation** only if Section 1 topology is reopened. |

**Cross-cutting backlog** (called out in spec/plan but not a separate numbered design phase):

- **Keepalived / VRRP:** authoritative host HA state (today: VIP TCP probe + explicit “not exported” gap); likely **host agent**, **read-only `/run` mount**, or **sidecar**.
- **Pi-hole HTTP / API reads:** dashboard data from Pi-hole’s API — needs **auth + secret-handling** decisions first.
- **UI:** richer operator shell or **built SPA** when the widget set is stable.
- **Packaging (optional):** publish a **prebuilt control-plane image** from **dns-fabric** CI and switch **`pihole-ha`** compose to **`image:`** instead of **`build:`**.

Design **§8** tracks smaller follow-ons (e.g. **200 + per-section errors vs 207**, **SSE reconnect / cursor** policy).

**When starting Phase 2+ work:** add a new plan slice or ADR per chosen thread; keep this file as the **Phase 1 bootstrap** record unless you explicitly supersede it.

**Per-phase implementation plans (dns-fabric):**

| Design §7 phase | Plan file |
|-------------------|-----------|
| **1** (hardening / spec closure) | [`2026-05-13-pihole-ha-control-plane-phase-1-hardening.md`](2026-05-13-pihole-ha-control-plane-phase-1-hardening.md) |
| **2** (DNS / Pi-hole write risk) | [`2026-05-13-pihole-ha-control-plane-phase-2-dns-write-risk.md`](2026-05-13-pihole-ha-control-plane-phase-2-dns-write-risk.md) |
| **3** (mutations + auth + audit) | [`2026-05-13-pihole-ha-control-plane-phase-3-mutations-audit.md`](2026-05-13-pihole-ha-control-plane-phase-3-mutations-audit.md) |
| **4** (aggregation, optional) | [`2026-05-13-pihole-ha-control-plane-phase-4-aggregation-optional.md`](2026-05-13-pihole-ha-control-plane-phase-4-aggregation-optional.md) |
