---
title: "ADR-0053: Pi-hole HA control plane — allowlisted .env mutations over HTTP"
adr: "0053"
status: Accepted
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

> MADR format. Every ADR lives in `docs/adr/` and is referenced by the
> architecture docs whose design depends on it.

## Status

`Accepted` — revises **ADR-0052** DNSCrypt deferral for **Tier-1** keys only.
Implementation follows
`docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-env-mutations-impl.md`.

## Context

Operators expect a **control plane** to enable/disable features (e.g. DNSCrypt)
and adjust **non-secret** settings from the dashboard. **ADR-0052** (Phase 3,
**Accepted**) intentionally returned **202** for stack mutations and forbade HTTP
DNSCrypt toggles. The embedded UI already **displays** `.env`-backed fields
(`sections.ha`, `sections.dnscrypt`) but cannot change them.

Forces:

- The host file **`${PIHOLE_HA_BASE}/.env`** remains operational truth (GitOps +
  refresh scripts).
- The control-plane container must **not** gain read-write access to the full
  `.env` (secrets live there).
- **ADR-0051** remains closed: **no** HTTP writes to Pi-hole/DNS
  **configuration files** (`pihole.toml`, upstream lists).

## Decision drivers

- Predictable LAN blast radius (boolean/URL toggles only on HTTP).
- Reuse Phase 3 **token + JSONL audit**; no generic command channel.
- Rollback must be **one operator action** without hand-editing JSON audit files.

## Considered options

1. **Option A — Read-only forever** — keep **ADR-0052**; UI links to host docs only.
2. **Option B — Allowlisted `.env` patch + host apply script** (this ADR).
3. **Option C — Writable `.env` bind mount in container** — rejected (container
   compromise exposes all secrets).

## Decision outcome

**Chosen option: Option B.**

### Tier model

| Tier | HTTP | Apply path |
|------|------|------------|
| **T1** | `PATCH /v1/config/env` then `POST /v1/mutations/env/apply` | Host `pihole-ha-apply-env-patch.sh` |
| **T2** | `POST /v1/mutations/*` → **202** `host_action_required` | `pihole-ha-refresh.sh` / mode scripts |
| **T3** | No route | Host / Git only |

Any `.env` key **not** listed in the appendix is treated as **T3 (deny)** until
this ADR is amended.

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

All mutation routes require **`CONTROL_PLANE_API_TOKEN`** (**403** generic, no
secret echo) and append **one audit line** per attempt (same sink as ADR-0052).

| Route | Method | Success | Body |
|-------|--------|---------|------|
| `/v1/config/env/schema` | GET | **200** | Tier-1 catalog: key, type, label, `tier`, `requires_apply` |
| `/v1/config/env` | GET | **200** | Effective Tier-1 values + `pending` if staged |
| `/v1/config/env` | PATCH | **202** | Stage patch: `{ "changes": { "<key>": "<value>" } }` |
| `/v1/mutations/env/apply` | POST | **200** or **202** | Apply staged patch via host script |
| `/v1/mutations/env/rollback` | POST | **200** or **202** | Restore latest `.env.bak.*` |
| `/v1/mutations/dnscrypt` | POST | **410** or **308** | **Deprecated** — alias to PATCH `DNSCRYPT_PROXY_ENABLED` + apply |

**Unchanged (ADR-0052):** `POST /v1/mutations/refresh` → **202** host-deferred.

**Still forbidden (ADR-0051 + this ADR):** any route that writes `pihole.toml`,
Pi-hole FTL config, or non-allowlisted `.env` keys.

### Host apply contract

- **Script (fixed path):** `/usr/local/bin/pihole-ha-apply-env-patch.sh`
  (installed from `pihole-ha/ops/runtime/control-plane/apply-env-patch.sh`).
- **Inputs:** `--node pi1|pi2`, `--patch-file` (JSON), `--dry-run` optional,
  `--rollback` to restore latest backup.
- **Preconditions:** patch keys ⊆ Tier-1 allowlist; `preflight.sh` passes after
  merge.
- **Backup:** before write, copy `.env` → `.env.bak.<unix_ts>` (same directory,
  mode **600**).
- **Writes:** merge keys into `${PIHOLE_HA_BASE}/.env` using `load_env_safe` /
  existing env helpers (no shell interpolation of values).
- **Post-apply:** run `render-config.sh` when `DNSCRYPT_*` changed; run
  **minimal** refresh (documented in ops matrix) — not full image pull unless
  `apply` request includes `refresh=full` (default **`minimal`**).

The API container invokes the script **only** if `CONTROL_PLANE_HOST_APPLY=1`
and sudoers grants **that argv only**; otherwise **`POST …/apply`** returns
**202** with `next_steps.scripts` (same envelope as today).

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

On apply success add `"backup_path": "/opt/pihole-ha/.env.bak.1715760000"`,
`"result": "applied"`. On failure `"result": "failed"`,
`"error_code": "preflight_rejected"` (no stack traces to client).

### Rollback

1. **Automatic backup** on every successful apply (see above).
2. **`POST /v1/mutations/env/rollback`** restores the **most recent**
   `.env.bak.*` for `${PIHOLE_HA_BASE}` (or `backup_id` query param if multiple
   retained).
3. Retain **last 5** backups per node; older files pruned by the apply script.
4. Rollback runs the **same** refresh pipeline as apply for keys that were in
   the restored file.
5. Audit: `"route": "mutations.env.rollback"`, `"result": "rolled_back"`,
   `"backup_path": "…"`.

### Revision to ADR-0052

- **DNSCrypt:** HTTP may change **`DNSCRYPT_PROXY_ENABLED`** /
  **`DNSCRYPT_PROXY_PORT`** only via Tier-1 routes + host apply — not via ad-hoc
  `docker exec` from the API container.
- **Generic deferral:** Tier-2/Tier-3 remain **202** / host scripts.

### Positive consequences

- UI can offer toggles with policy-backed safety.
- Blast radius bounded to seven keys.

### Negative consequences

- Requires sudoers / host script install discipline.
- Two-step PATCH+apply unless host apply is enabled.

## Validation

- ADR **Accepted** in dns-fabric before merging implementation.
- Contract tests: PATCH unknown key → **422**; secret key → **403**; audit line
  on deny/apply/rollback.
- Manual smoke: toggle DNSCrypt off → on → rollback → `sections.dnscrypt`
  matches `.env`.

## Pros and cons of the options

### Option A

- ✅ Smallest mutation surface; no new host script.
- ❌ Dashboard remains display-only for `.env` toggles.

### Option B

- ✅ Bounded, auditable operator ergonomics.
- ❌ Host script + sudoers discipline required.

### Option C

- ❌ Rejected — full `.env` exposure on container compromise.

## Links

- Related ADRs:
  `docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md`,
  `docs/adr/ADR-0051-pihole-ha-control-plane-phase2-dns-writes.md`
- Related docs: `docs/operations/control-plane-env-mutations.md`
- Implementation plan (after acceptance):
  `docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-env-mutations-impl.md`

## Appendix: `.env` key tiers (from `.env_example` contract)

| Key | Tier |
|-----|------|
| `DNSCRYPT_PROXY_ENABLED`, `DNSCRYPT_PROXY_PORT` | T1 |
| `CONTROL_PLANE_UI_ENABLED`, `CONTROL_PLANE_UI_HOST_PORT`, `CONTROL_PLANE_NODE_NAME`, `CONTROL_PLANE_PEER_UI_BASE_URL`, `CONTROL_PLANE_KEA_FABRIC_API_BASE_URL` | T1 |
| `DHCP_MODE`, `DHCP_ENABLE_INTENT`, `DHCP_INTERFACE`, `DHCP_SUBNET_CIDR`, `DHCP_POOL_START`, `DHCP_POOL_END`, `KEA_*` | T2 |
| `PIHOLE_VIP`, `PIHOLE_VIP_PREFIX_LEN`, `PIHOLE_NODE1`, `PIHOLE_NODE2`, `ROUTER_IP`, `KEEPALIVED_*`, `PIHOLE_HA_NODE` | T2 |
| `PIHOLE_HA_BASE`, `TZ`, `NEBULA_PRIMARY`, `NEBULA_REPLICAS` | T2 |
| `CONTROL_PLANE_MAINTENANCE_LOG`, `CONTROL_PLANE_AUDIT_LOG` | T2 (paths; install/ops) |
| `PIHOLE_WEBPASSWORD`, `NEBULA_WEB_PASSWORD`, `KEEPALIVED_AUTH_PASS`, `CONTROL_PLANE_API_TOKEN` | T3 |
| `CONFIG_SCHEMA_VERSION` | T3 |

## Change Log

| Date | Status | Reviewer | Notes |
|------|--------|----------|-------|
| 2026-05-15 | Proposed | GriffinAD | Option B allowlist + rollback |
| 2026-05-15 | Accepted | GriffinAD | Rollback strategy approved; implementation plan linked |
