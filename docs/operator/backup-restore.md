# Backup and restore

## What to back up

At minimum, plan for:

- **Configuration** — `/etc/kea-fabric/` and operator-managed config stores.
- **Persistent state** — databases and registry paths described in [`../architecture/data.md`](../architecture/data.md).
- **Audit trail expectations** — retention and integrity goals ([`../architecture/data-governance.md`](../architecture/data-governance.md)).
- **Plugin artefacts** — local plugin directories if you rely on operator-drop layout ([`../architecture/marketplace.md`](../architecture/marketplace.md)).

## Restore order

1. Restore configuration consistent with the target version ([`upgrade.md`](upgrade.md)).
2. Restore persistent stores with the same schema generation expected by that release.
3. Re-verify plugin manifests and hashes before enablement.
4. Run post-restore smoke checks ([`../architecture/deployment.md`](../architecture/deployment.md)).

## Cross-refs

- [`../architecture/data.md`](../architecture/data.md)
- [`troubleshooting.md`](troubleshooting.md)
