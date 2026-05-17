# Pi-hole HA control plane — `.env` mutations ADR (Option B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add **ADR-0053** (dns-fabric) that **revises the Phase 3 mutation policy** in **ADR-0052** with an explicit **allowlist** of `.env` keys, **HTTP routes**, **audit fields**, and **rollback** rules so a follow-on plan can ship a **settings UI** in `pi-fabric` and **API** in `pihole-ha` without ad-hoc scope creep.

**Architecture:** Keep **GitOps + host scripts** as source of truth. The control plane **never** exposes a generic `.env` editor or shell. **Tier-1** keys may be changed via **`PATCH /v1/config/env`** plus a **single host helper** (`apply-env-patch.sh`) that backs up `.env`, applies allowlisted deltas, runs **`render-config.sh`** when required, and triggers a **named refresh** subset. **Tier-2** keys stay **`202 host_action_required`** (today’s **ADR-0052** semantics). **Tier-3** secrets and network identity keys are **never HTTP-writable**.

**Tech Stack:** MADR ADRs in `dns-fabric`; cross-links in `pihole-ha` ops docs; existing **`audit_log.py`** + **`CONTROL_PLANE_API_TOKEN`** from Phase 3.

**Normative inputs:** `docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md`, `docs/adr/ADR-0051-pihole-ha-control-plane-phase2-dns-writes.md`, `pihole-ha/.env_example`, `pihole-ha/platform/control-plane/app/routes/mutations.py`, design spec §7 Phase 3.

**Out of scope for this plan:** Svelte settings forms, FastAPI route implementation, OpenAPI export, sudoers install — those belong in **`2026-05-15-pihole-ha-control-plane-env-mutations-impl.md`** (create **after** ADR-0053 is **Accepted**).

---

## File map (this plan only)

| Path | Responsibility |
|------|----------------|
| `docs/adr/ADR-0053-pihole-ha-control-plane-env-mutations.md` | **New** — allowlist, routes, audit, rollback (dns-fabric) |
| `docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md` | **Modify** — Change Log + link; DNSCrypt bullet notes **ADR-0053** supersedes deferral for Tier-1 only |
| `docs/operations/control-plane-env-mutations.md` | **New** — operator matrix (dns-fabric; mirrors pihole-ha page) |
| `pihole-ha/docs/operations/control-plane-env-mutations.md` | **New** — same matrix, lives with runtime repo |
| `pihole-ha/docs/operations/control-plane-mutations.md` | **Modify** — link ADR-0053 + route table |
| `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` | **Modify** — §8 open decision: env UI gated on ADR-0053 |

---

### Task 1: Classify `.env` keys (inventory → tiers)

**Files:**

- Read: `pihole-ha/.env_example`
- Read: `pihole-ha/platform/core/docker-compose.control-plane.override.yml`
- Read: `pihole-ha/ops/lib/compose-core.sh`

- [x] **Step 1: Produce tier table (paste into ADR-0053 §Decision outcome)**

Run on a checkout of `pihole-ha`:

```bash
cd /opt/pihole-ha   # or local clone
rg -n '^[A-Z][A-Z0-9_]+=' .env_example | cut -d= -f1 | sort -u
```

Classify every key into exactly one tier:

| Tier | Meaning | HTTP |
|------|---------|------|
| **T1** | Safe operator toggles; single-key or URL metadata; tested rollback | `PATCH /v1/config/env` + apply |
| **T2** | Stack-shaping; needs `render-config` + full refresh + human intent | **202** only (`host_action_required`) |
| **T3** | Secrets / identity / schema | **Never** HTTP |

**Mandatory classification (do not change without ADR revision):**

| Key | Tier | Rationale |
|-----|------|-----------|
| `DNSCRYPT_PROXY_ENABLED` | **T1** | Boolean; compose file list; `render-config` documented in `.env_example` |
| `DNSCRYPT_PROXY_PORT` | **T1** | Integer 1024–65535; only honored when DNSCrypt enabled |
| `CONTROL_PLANE_UI_ENABLED` | **T1** | Boolean; `compose-core.sh` merge only |
| `CONTROL_PLANE_UI_HOST_PORT` | **T1** | Port 1024–65535; recreate control-plane publish |
| `CONTROL_PLANE_NODE_NAME` | **T1** | Label string `^[a-zA-Z0-9._-]{1,32}$` |
| `CONTROL_PLANE_PEER_UI_BASE_URL` | **T1** | URL or empty; no stack file writes |
| `CONTROL_PLANE_KEA_FABRIC_API_BASE_URL` | **T1** | URL or empty; UI client only |
| `DHCP_MODE`, `DHCP_ENABLE_INTENT`, `DHCP_*`, `KEA_*` | **T2** | Mode scripts + safety intent ([`ops/install/modes/`](pihole-ha)) |
| `PIHOLE_VIP`, `PIHOLE_NODE1`, `PIHOLE_NODE2`, `ROUTER_IP`, `KEEPALIVED_*` | **T2** | LAN/VRRP breakage risk |
| `PIHOLE_WEBPASSWORD`, `NEBULA_WEB_PASSWORD`, `KEEPALIVED_AUTH_PASS` | **T3** | Secrets |
| `CONTROL_PLANE_API_TOKEN` | **T3** | Auth secret; rotate on host only |
| `CONFIG_SCHEMA_VERSION` | **T3** | Contract version; Git-only |
| `PIHOLE_HA_BASE`, `TZ`, `NEBULA_PRIMARY`, `NEBULA_REPLICAS` | **T2** | Path/topology; not toggle UI |

- [x] **Step 2: Record “no new keys without ADR” rule**

Add to ADR-0053: any key not listed in the ADR appendix is **T3 (deny)** until the ADR is amended.

---

### Task 2: Write ADR-0053 (full text)

**Files:**

- Create: `docs/adr/ADR-0053-pihole-ha-control-plane-env-mutations.md`

- [x] **Step 1: Create ADR from template with this body**

Use `docs/_templates/ADR_TEMPLATE.md` frontmatter. Set **`status: Proposed`** until human accepts.

```markdown
---
title: "ADR-0053: Pi-hole HA control plane — allowlisted .env mutations over HTTP"
adr: "0053"
status: Proposed
date: 2026-05-15
owner: GriffinAD
peer_reviewer: GriffinAD
deciders: [GriffinAD]
due_date: null
re_entry_criteria: null
touch_points:
  - GriffinAD/pihole-ha
  - GriffinAD/dns-fabric
  - docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md
  - docs/adr/ADR-0051-pihole-ha-control-plane-phase2-dns-writes.md
---

# ADR-0053: Pi-hole HA control plane — allowlisted .env mutations over HTTP

## Status

`Proposed` — revises **ADR-0052** DNSCrypt deferral for **Tier-1** keys only.

## Context

Operators expect a **control plane** to enable/disable features (e.g. DNSCrypt) and adjust **non-secret** settings from the dashboard. **ADR-0052** (Phase 3, **Accepted**) intentionally returned **202** for all stack mutations and forbade HTTP DNSCrypt toggles. The embedded UI already **displays** `.env`-backed fields (`sections.ha`, `sections.dnscrypt`) but cannot change them.

Forces:

- The host file **`${PIHOLE_HA_BASE}/.env`** remains operational truth (GitOps + refresh scripts).
- The control-plane container must **not** gain read-write access to the full `.env` (secrets live there).
- **ADR-0051** remains closed: **no** HTTP writes to Pi-hole/DNS **configuration files** (`pihole.toml`, upstream lists).

## Decision drivers

- Predictable LAN blast radius (boolean/URL toggles only on HTTP).
- Reuse Phase 3 **token + JSONL audit**; no generic command channel.
- Rollback must be **one operator action** without hand-editing JSON audit files.

## Considered options

1. **Option A — Read-only forever** — keep **ADR-0052**; UI links to host docs only.
2. **Option B — Allowlisted `.env` patch + host apply script** (this ADR).
3. **Option C — Writable `.env` bind mount in container** — rejected (container compromise exposes all secrets).

## Decision outcome

**Chosen option: Option B.**

### Tier model

| Tier | HTTP | Apply path |
|------|------|------------|
| **T1** | `PATCH /v1/config/env` then `POST /v1/mutations/env/apply` | Host `pihole-ha-apply-env-patch.sh` |
| **T2** | `POST /v1/mutations/*` → **202** `host_action_required` | `pihole-ha-refresh.sh` / mode scripts |
| **T3** | No route | Host / Git only |

### Tier-1 allowlist (only these keys)

| Key | Type | Validation | Host side-effects |
|-----|------|------------|-------------------|
| `DNSCRYPT_PROXY_ENABLED` | `0` \| `1` | — | `render-config.sh --node <pi1\|pi2>`; reconcile core stack |
| `DNSCRYPT_PROXY_PORT` | integer | 1024–65535 | same when enabled |
| `CONTROL_PLANE_UI_ENABLED` | `0` \| `1` | — | `compose-core` file list; `docker compose up` control-plane |
| `CONTROL_PLANE_UI_HOST_PORT` | integer | 1024–65535 | recreate published port |
| `CONTROL_PLANE_NODE_NAME` | string | `^[a-zA-Z0-9._-]{1,32}$` | env pass-through; optional recreate |
| `CONTROL_PLANE_PEER_UI_BASE_URL` | string | empty or `http(s)://` URL | none |
| `CONTROL_PLANE_KEA_FABRIC_API_BASE_URL` | string | empty or `http(s)://` URL | none |

### HTTP routes (allowlist)

All mutation routes require **`CONTROL_PLANE_API_TOKEN`** (**403** generic, no secret echo) and append **one audit line** per attempt (same sink as ADR-0052).

| Route | Method | Success | Body |
|-------|--------|---------|------|
| `/v1/config/env/schema` | GET | **200** | Tier-1 catalog: key, type, label, `tier`, `requires_apply` |
| `/v1/config/env` | GET | **200** | Effective Tier-1 values + `pending` if staged |
| `/v1/config/env` | PATCH | **202** | Stage patch: `{ "changes": { "<key>": "<value>" } }` |
| `/v1/mutations/env/apply` | POST | **200** or **202** | Apply staged patch via host script |
| `/v1/mutations/env/rollback` | POST | **200** or **202** | Restore latest `.env.bak.*` |
| `/v1/mutations/dnscrypt` | POST | **410** or **308** | **Deprecated** — document alias to PATCH `DNSCRYPT_PROXY_ENABLED` + apply |

**Unchanged (ADR-0052):** `POST /v1/mutations/refresh` → **202** host-deferred.

**Still forbidden (ADR-0051 + this ADR):** any route that writes `pihole.toml`, Pi-hole FTL config, or non-allowlisted `.env` keys.

### Host apply contract

- **Script (fixed path):** `/usr/local/bin/pihole-ha-apply-env-patch.sh` (installed from `pihole-ha/ops/runtime/control-plane/apply-env-patch.sh`).
- **Inputs:** `--node pi1|pi2`, `--patch-file` (JSON), `--dry-run` optional.
- **Preconditions:** patch keys ⊆ Tier-1 allowlist; `preflight.sh` passes after merge.
- **Backup:** before write, copy `.env` → `.env.bak.<unix_ts>` (same directory, mode **600**).
- **Writes:** merge keys into `${PIHOLE_HA_BASE}/.env` using `load_env_safe` / existing env helpers (no shell interpolation of values).
- **Post-apply:** run `render-config.sh` when `DNSCRYPT_*` changed; run **minimal** refresh (documented in ops matrix) — not full image pull unless `apply` request includes `refresh=full` (default **`minimal`**).

The API container invokes the script **only** if `CONTROL_PLANE_HOST_APPLY=1` and sudoers grants **that argv only**; otherwise **`POST …/apply`** returns **202** with `next_steps.scripts` (same envelope as today).

### Audit fields (required JSONL keys)

Every mutation attempt logs:

```json
{
  "route": "config.env.patch",
  "node": "pi2",
  "result": "accepted_staged",
  "actor": "api_token",
  "changes": {"DNSCRYPT_PROXY_ENABLED": "1"},
  "backup_path": null
}
```

On apply success add `"backup_path": "/opt/pihole-ha/.env.bak.1715760000"`, `"result": "applied"`. On failure `"result": "failed"`, `"error_code": "preflight_rejected"` (no stack traces to client).

### Rollback

1. **Automatic backup** on every successful apply (see above).
2. **`POST /v1/mutations/env/rollback`** restores the **most recent** `.env.bak.*` for `${PIHOLE_HA_BASE}` (or `backup_id` query param if multiple retained).
3. Retain **last 5** backups per node; older files pruned by the apply script.
4. Rollback runs the **same** refresh pipeline as apply for keys that were in the restored file.
5. Audit: `"route": "mutations.env.rollback"`, `"result": "rolled_back"`, `"backup_path": "…"`.

### Revision to ADR-0052

- **DNSCrypt:** HTTP may change **`DNSCRYPT_PROXY_ENABLED`** / **`DNSCRYPT_PROXY_PORT`** only via Tier-1 routes + host apply — not via ad-hoc `docker exec` from the API container.
- **Generic deferral:** Tier-2/Tier-3 remain **202** / host scripts.

### Positive consequences

- UI can offer toggles with policy-backed safety.
- Blast radius bounded to seven keys.

### Negative consequences

- Requires sudoers / host script install discipline.
- Two-step PATCH+apply unless host apply is enabled.

## Validation

- ADR **Accepted** in dns-fabric before merging implementation.
- Contract tests: PATCH unknown key → **422**; secret key → **403**; audit line on deny/apply/rollback.
- Manual smoke: toggle DNSCrypt off → on → rollback → `sections.dnscrypt` matches `.env`.

## Links

- ADR-0052, ADR-0051
- `docs/operations/control-plane-env-mutations.md`
- Implementation plan: `docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-env-mutations-impl.md` (after acceptance)

## Change Log

| Date | Status | Reviewer | Notes |
|------|--------|----------|-------|
| 2026-05-15 | Proposed | GriffinAD | Option B allowlist + rollback |

```

- [x] **Step 2: Self-review ADR against ADR-0051**

Confirm **no** route writes `pihole.toml` or Pi-hole DNS disk config. If any sentence implies Pi-hole API writes, delete it.

- [ ] **Step 3: Commit (dns-fabric)**

```bash
cd /Volumes/Data/piHole/pi-fabric
test "$(git config --local user.name)" = "GriffinAD"
test "$(git config --local user.email)" = "nigel.surridge@btinternet.com"
git add docs/adr/ADR-0053-pihole-ha-control-plane-env-mutations.md
git commit -s -m "$(cat <<'EOF'
docs(adr): ADR-0053 allowlisted control plane .env mutations

Defines Tier-1 keys, HTTP routes, host apply script contract,
audit fields, and rollback policy for operator settings UI.

EOF
)"
```

---

### Task 3: Cross-link ADR-0052

**Files:**

- Modify: `docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md`

- [x] **Step 1: Add under Decision outcome (after DNSCrypt bullet)**

```markdown

- **Env / feature toggles (Tier-1):** see **`ADR-0053`** — supersedes the
  “no HTTP DNSCrypt toggle” bullet **only** for allowlisted `.env` keys and
  routes documented there. Tier-2/Tier-3 keys remain host-deferred (**202**).
```

- [x] **Step 2: Add Change Log row**

```markdown
| 2026-05-15 | Accepted (partial revision) | GriffinAD | Tier-1 env mutations delegated to ADR-0053. |
```

(Set status note only after ADR-0053 is **Accepted**; until then use `Proposed` cross-link without changing ADR-0052 status.)

- [ ] **Step 3: Commit**

```bash
git add docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md
git commit -s -m "docs(adr): cross-link ADR-0052 to env mutations ADR-0053"
```

---

### Task 4: Operator matrix docs (dns-fabric + pihole-ha)

**Files:**

- Create: `docs/operations/control-plane-env-mutations.md`
- Create: `pihole-ha/docs/operations/control-plane-env-mutations.md` (identical body; adjust relative links)

- [x] **Step 1: Write operator matrix**

```markdown
# Control plane `.env` mutations (ADR-0053)

Normative: [ADR-0053](../adr/ADR-0053-pihole-ha-control-plane-env-mutations.md).

## Tier-1 (HTTP when ADR-0053 implementation is shipped)

| Key | UI control | Apply |
|-----|------------|-------|
| DNSCrypt enabled | Toggle | `render-config` + core reconcile |
| DNSCrypt port | Number | when enabled |
| Control plane UI | Toggle | compose merge |
| Control plane port | Number | recreate service |
| Node name | Text | label |
| Peer UI URL | URL | link in chrome |
| Kea Fabric API URL | URL | embedded client |

## Tier-2 (202 — host scripts only)

`DHCP_MODE`, VIP, node IPs, Kea role, Nebula URLs, full refresh — use:

```bash
sudo /usr/local/bin/pihole-ha-refresh.sh --node pi1
```

## Tier-3 (never HTTP)

Passwords, `CONTROL_PLANE_API_TOKEN`, `CONFIG_SCHEMA_VERSION`.

## Tier rollback (operator)

```bash
sudo /usr/local/bin/pihole-ha-apply-env-patch.sh --node pi2 --rollback
```

Or `POST /v1/mutations/env/rollback` with valid API token when host apply is enabled.

```

- [ ] **Step 2: Patch `pihole-ha/docs/operations/control-plane-mutations.md`**

Add after the Phase 3 table:

```markdown
## Env / settings (ADR-0053)

See [control-plane-env-mutations.md](control-plane-env-mutations.md) for Tier-1/Tier-2/Tier-3 keys and rollback.
```

- [ ] **Step 3: Run docs checks (dns-fabric)**

```bash
cd /Volumes/Data/piHole/pi-fabric
npm run check:docs-text
```

Expected: PASS (fix markdownlint/cspell on new filenames if flagged).

- [ ] **Step 4: Commit both repos**

dns-fabric: `docs/operations/control-plane-env-mutations.md`  
pihole-ha: `docs/operations/control-plane-env-mutations.md` + `control-plane-mutations.md` link

---

### Task 5: Spec §8 — close open decision

**Files:**

- Modify: `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md`

- [x] **Step 1: Add to §8 Open decisions**

```markdown

- **Env / settings UI:** gated on **ADR-0053** (`Accepted`) + implementation plan
  `2026-05-15-pihole-ha-control-plane-env-mutations-impl.md`; read-only display until then.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md
git commit -s -m "docs(spec): gate env settings UI on ADR-0053"
```

---

### Task 6: Human acceptance gate

- [x] **Step 1: Review checklist (peer / owner)**

| Question | Expected |
|----------|----------|
| Any Tier-1 key that can brick DNS without refresh? | Documented side-effects + refresh |
| Secrets reachable via PATCH? | **No** — Tier-3 |
| ADR-0051 violated? | **No** Pi-hole file writes |
| Rollback tested on paper? | `.env.bak.<ts>` + rollback route |

- [x] **Step 2: Flip ADR-0053 status to `Accepted`**

Edit frontmatter `status: Accepted` and Change Log row; then commit:

```bash
git commit -s -m "docs(adr): accept ADR-0053 env mutation allowlist"
```

- [x] **Step 3: Note follow-on plan filename**

Created **`docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-env-mutations-impl.md`**.

---

## Self-review (spec coverage)

| Requirement | Task |
|-------------|------|
| Exact keys allowlisted | Task 1 table + ADR-0053 Tier-1 |
| Exact HTTP routes | ADR-0053 route table |
| Audit shape | ADR-0053 audit JSON |
| Rollback | ADR-0053 rollback § + ops doc |
| ADR-0052 revision | Task 3 |
| No placeholder TBD in normative ADR body | Task 2 full text |
| UI implementation deferred | Out of scope + spec §8 |

| Red-flag scan | Result |
|---------------|--------|
| “Add appropriate validation” without rules | Avoided — port/regex in ADR |
| “Similar to Task N” | Each task standalone |
| Writable `.env` mount | Explicitly rejected (Option C) |

---

**Plan complete and saved to** `docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-env-mutations-adr.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — one subagent per task; review after Task 2 (ADR text) before docs commits.

2. **Inline execution** — run Tasks 1–6 in this session with checkpoints at ADR draft and human **Accepted** gate.

**Which approach?**

After ADR-0053 is **Accepted**, ask for the **implementation plan** (`env-mutations-impl`) for: `apply-env-patch.sh`, FastAPI routes, OpenAPI, Vitest settings panel, and compose/sudoers install notes.
