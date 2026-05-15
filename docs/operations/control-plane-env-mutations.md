# Control plane `.env` mutations (ADR-0053)

Normative policy: [ADR-0053](../adr/ADR-0053-pihole-ha-control-plane-env-mutations.md).

Phase 3 baseline (auth + audit, **202** deferrals): [ADR-0052](../adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md).

**Status:** ADR-0053 is **`Accepted`**. Routes and UI ship per
`docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-env-mutations-impl.md`
(not yet on nodes until that plan is executed and deployed).

## Tier-1 (HTTP when implemented)

| Key | UI control | Host apply side-effects |
|-----|------------|-------------------------|
| `DNSCRYPT_PROXY_ENABLED` | Toggle | `render-config.sh`; core stack reconcile |
| `DNSCRYPT_PROXY_PORT` | Number (1024–65535) | When DNSCrypt enabled |
| `CONTROL_PLANE_UI_ENABLED` | Toggle | `compose-core` merge; control-plane service |
| `CONTROL_PLANE_UI_HOST_PORT` | Number | Recreate published port |
| `CONTROL_PLANE_NODE_NAME` | Text | Label in `/dashboard` / chrome |
| `CONTROL_PLANE_PEER_UI_BASE_URL` | URL | Peer link only |
| `CONTROL_PLANE_KEA_FABRIC_API_BASE_URL` | URL | Embedded Kea Fabric client origin |

**Flow:** `PATCH /v1/config/env` (stage) → `POST /v1/mutations/env/apply` (host script), or **202** with script names when `CONTROL_PLANE_HOST_APPLY` is not enabled.

## Tier-2 (202 — host scripts only)

`DHCP_MODE`, `DHCP_ENABLE_INTENT`, VIP, node IPs, Kea role, Nebula URLs, full stack refresh — use:

```bash
sudo /usr/local/bin/pihole-ha-refresh.sh --node pi1
# or pi2
```

See `pihole-ha` [control-plane-mutations.md](https://github.com/GriffinAD/pihole-ha/blob/main/docs/operations/control-plane-mutations.md) for the Phase 3 truth table.

## Tier-3 (never HTTP)

Passwords (`PIHOLE_WEBPASSWORD`, `NEBULA_WEB_PASSWORD`, `KEEPALIVED_AUTH_PASS`),
`CONTROL_PLANE_API_TOKEN`, `CONFIG_SCHEMA_VERSION`.

## Rollback

After implementation:

```bash
sudo /usr/local/bin/pihole-ha-apply-env-patch.sh --node pi2 --rollback
```

Or `POST /v1/mutations/env/rollback` with a valid API token when host apply is enabled.

Automatic backups: `${PIHOLE_HA_BASE}/.env.bak.<unix_ts>` (last **5** retained).

## Related

- Implementation plan (after ADR acceptance): `docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-env-mutations-impl.md` (to be created)
- ADR drafting plan: `docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-env-mutations-adr.md`
