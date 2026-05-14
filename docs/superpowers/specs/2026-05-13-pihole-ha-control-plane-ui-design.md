# Pi-hole HA per-node control plane and dashboard UI — design

**Status:** Phase 1 read path implemented on **`pihole-ha`** **`main`** (lineage includes **`ecdcaf7`**); this document remains normative for Phase 2+ (mutations with auth/audit, Pi-hole writes, richer HA).  
**Date:** 2026-05-13  
**Scope:** Docker-based **UI layer** and **HTTP API control plane** that runs **on each node** of the **`pihole-ha`** deployment (operator clone path often `/Volumes/Data/piHole/pihole-ha` or `/opt/pihole-ha` on nodes), integrating with **local** host and container state. **`pi-fabric` (Kea Fabric)** supplies reusable patterns (OpenAPI-backed API, dashboard composition, log streaming); **product-specific probes and compose contracts** live with **`pihole-ha`** or a clearly versioned adjunct.

---

## 1. Problem and goals

Operators need a **customisable dashboard** on each Pi-hole HA node to **display and interact with**:

- Current **HA role** (master / secondary) and **status**
- **DNS** configuration (read-first; writes are a later slice)
- **DNSCrypt** enablement / disablement (mutation — **not** default in v1)
- **Nebula sync** status
- **Keepalived** / **VIP** visibility
- **DHCP via Kea** when enabled
- **Cron** (or **named scheduled jobs**) status
- **Log viewers** driven by a **dropdown**, backed by a **server-defined catalogue** (no client-supplied paths)

**Non-goals for this document’s v1 read slice:** a single global URL that follows the VIP; cross-node orchestration from one brain; unauthenticated mutations; arbitrary command execution from the UI.

---

## 2. Context

### 2.1 `pihole-ha` (target platform)

Two-node HA Pi-hole with **Keepalived** VIP, **Docker Compose** stacks, **Nebula Sync**, optional **DNSCrypt** overlay, optional **Kea** DHCP. Core services often use **`network_mode: host`**. Operational truth remains **Git + refresh scripts** (e.g. `pihole-ha-refresh.sh`); Portainer is deploy UI, not source of truth.

### 2.2 `pi-fabric` (this repository)

Documentation-first management plane with **operator API** and **UI** patterns (OpenAPI, SSE-style streaming, strict checks). This design **does not** require renaming Kea Fabric; it defines a **sibling product** or **striped-down reuse** of UI/API scaffolding **without** contradicting accepted Kea Fabric ADRs for the Kea product unless a future ADR explicitly merges scope.

---

## 3. Architectural options (recorded decision)

| Option | Description | Verdict |
|--------|-------------|---------|
| **A** | Per-node API + UI on **each** Pi | **Selected** |
| **B** | Only on VIP / master | Rejected for v1 (host networking and failover routing complexity) |
| **C** | Central third host + agents | Deferred |

### 3.1 Packaging (v1)

**v1 ships one Compose service (one container image)** where a **single server process** serves both the **built static operator UI** and the **HTTP API** (including SSE), on **one published port**. Same-origin behaviour is therefore default. A **separate nginx (or similar) front container** is **out of scope for v1**; it may be revisited if TLS termination, heavy static tuning, or independent API/static lifecycles become requirements.

---

## 4. Approved design — Section 1: Deployment and topology

- **Placement:** Small **per-node** stack on **Pi1** and **Pi2**, same GitOps / refresh discipline as existing stacks.
- **Operator model:** Two bookmarks (Pi1 URL vs Pi2 URL). **No** v1 requirement for follow-the-VIP DNS routing.
- **Labelling:** Explicit config: **`NODE_NAME`** (or equivalent) and optional **`PEER_UI_BASE_URL`** for a peer link in the chrome.
- **Data locality:** All probes and log access are **local to that host** only. Cross-node comparison is **out of scope for v1**.
- **Security default:** **Read-only** API and UI unless a **separate** mutation slice adds authn/z, audit, and explicit operator workflows.

---

## 5. Approved design — Section 2: Components and boundaries

### 5.1 UI

- **Dashboard shell:** layout + **widget registry**; each widget binds to named API resources.
- **Chrome:** node banner, optional peer link, build/version string.
- **Logs:** dropdown populated from **`GET /logs/catalog`**; stream via **`GET /logs/stream/{id}`** (SSE or equivalent).

### 5.2 HTTP API (“control plane”)

- **OpenAPI-described** HTTP API per node, **co-served with the static UI from the same v1 container** (see §3.1).
- **Aggregates** read models for widgets; **streams** only catalogue-backed log sources.
- **No** business rules in the browser beyond presentation.

### 5.3 Adapters (internal modules)

| Adapter | Role |
|---------|------|
| **Docker / Compose** | Named containers, health, read-only inspect as needed |
| **Host / VIP** | VIP ownership and Keepalived-oriented **read-only** summary |
| **Pi-hole / DNS** | Read-only summary; write strategy deferred |
| **DNSCrypt** | Observed state (compose/env + container); toggle deferred |
| **Nebula sync** | Container / process + health / log-derived hints |
| **Kea** | Optional presence and health |
| **Cron / schedules** | **Allowlisted** crons or systemd timers only |
| **Logs** | Catalogue id → exactly one backend (file under allowlist, `journalctl` with fixed args, or Docker logs for named containers) |

**Rules:** adapters **do not** call each other; the API layer composes them. **No** user-supplied shell. Paths and commands are **constants + configured roots** (e.g. `PIHOLE_HA_BASE`).

### 5.4 Repository split

- **`pihole-ha`:** compose, volumes, env contract, catalogue contents, ops smoke docs.
- **`pi-fabric`:** reusable UI shell and API scaffolding patterns; Pi-hole-specific probes ship in **`pihole-ha`** unless a later decision vendors shared libraries.

---

## 6. Approved design — Section 3: Data flow, errors, and testing

### 6.1 Read flow

1. UI loads node config and **`GET /dashboard`** (layout + endpoint bindings) and **`GET /logs/catalog`**.
2. Widgets call **focused read endpoints**; API runs adapters **in parallel** with **per-adapter timeouts**.
3. Log dropdown selects **`id`** → **`GET /logs/stream/{id}`** (SSE).
4. **Mutations:** **none** in default v1 build, or **disabled by feature flag** until auth and audit are specified.

### 6.2 Errors and degradation

- Prefer **partial results**: HTTP **200** with **per-section** `ok` / `error` and stable **error codes** (alternative: standardized **207** — pick one in implementation and keep consistent).
- **Timeouts:** mark affected sections stale; avoid whole-page **500** for single probe failure.
- **Misconfiguration:** clear operator-facing message when `docker.sock` or required paths are unavailable.
- **403** for auth failures without leaking internals.

### 6.3 Testing

- **Unit:** each adapter with fakes (Docker, filesystem, clock).
- **Contract:** OpenAPI drift check; golden or strict JSON assertions for dashboard and catalogue responses.
- **Log security:** tests assert **no path escape** from catalogue ids.
- **Integration:** documented **manual smoke** on a real node (optional CI job only if a harness exists).

---

## 7. Phased delivery (recommended)

| Phase | Content |
|-------|---------|
| **1** | Read-only dashboard + log catalogue + SSE streams + per-node compose in `pihole-ha` (**one container:** static UI + API) |
| **2** | Pi-hole/DNS write paths (if any) with explicit risk review |
| **3** | DNSCrypt / refresh-script class mutations with **auth + audit** |
| **4** | Optional centralisation or peer aggregation **only** if requirements re-open Section 1 |

Per-phase **implementation plans** (checklists, commands, code): see **`docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-phase-*`** and **`docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-ui-svelte-dashboard.md`** (Svelte DnD UI); index table in **`docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-ui.md`**.

---

## 8. Open decisions (for implementation plan, not blockers for this spec)

- Exact **error envelope** (200 + sections vs 207).
- **SSE** reconnect policy (cursor vs “tail from now”).

---

## 9. Related documents

- `pihole-ha` README and `platform/core/docker-compose.yml`
- `pi-fabric` `README.md`, `AGENTS.md`, `docs/architecture/api.md`, `docs/architecture/ui.md`

---

## 10. Self-review checklist (completed)

- **Placeholders:** Section 8 lists remaining follow-ons (error envelope, SSE reconnect); no `TBD` in normative sections.
- **Consistency:** Per-node (A), read-first, catalogue-backed logs, **v1 single-container static+API** (§3.1), adapter boundaries align across sections.
- **Scope:** Single implementation-plan target = **Phase 1**; later phases listed separately.
- **Ambiguity:** Mutation behaviour explicitly default-off; cross-node explicitly out of v1.
