# Operator guide

> Tier D — operational runbooks for running Kea Fabric alongside ISC Kea.
> Complements [`../architecture/deployment.md`](../architecture/deployment.md),
> [`../architecture/config.md`](../architecture/config.md), and
> [`../architecture/kea-integration.md`](../architecture/kea-integration.md).

## First five minutes (local dev)

1. **API** — From the repository root, start the HTTP server with example plugins (see [Install — local development with example plugins](install.md#local-development-with-example-plugins)): `bash scripts/dev_serve_with_examples.sh` (listens on `127.0.0.1:8080` with reload).
2. **Sanity** — `curl -s http://127.0.0.1:8080/api/v1/health` should return JSON with `"status":"ok"`. `curl -s http://127.0.0.1:8080/api/v1/plugins` should list discovered bundles under `plugins/examples`.
3. **UI** — In `apps/ui`, run `npm run dev` and open the shell (Vite proxies `/api` to the API). Visit **`#/plugins`** to confirm tables populate when plugins are running.
4. **When something looks off** — Use [Troubleshooting](troubleshooting.md) and, for plugin payloads, [Plugins diagnostics](runbooks/plugins-diagnostics.md).

## Contents

| Doc | Purpose |
| --- | --- |
| [Install](install.md) | Prerequisites, packaging choices, first boot, build/verify wheels, local example plugins. |
| [Configure](configure.md) | Config layers, secrets, reload semantics. |
| [Backup and restore](backup-restore.md) | What to back up, restore order, validation. |
| [Upgrade](upgrade.md) | Safe upgrade and rollback posture. |
| [Troubleshooting](troubleshooting.md) | Symptom index and triage flow. |
| [Runbooks](runbooks/README.md) | Per-failure-mode procedures. |

## Assumptions

- Kea is **operator-provided**; Kea Fabric does not bundle Kea ([`../architecture/kea-integration.md`](../architecture/kea-integration.md)).
- Roadmap phases **1–5**: plugin distribution is **local** only ([`../architecture/marketplace.md`](../architecture/marketplace.md)).
