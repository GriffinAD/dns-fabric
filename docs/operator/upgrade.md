# Upgrade

## Policy

- Follow release channels and branching described in [`../architecture/release-process.md`](../architecture/release-process.md).
- Read migration notes shipped with the release; schema migrations are forward-only ([`../architecture/data.md`](../architecture/data.md)).

## Safe upgrade sequence (conceptual)

1. **Backup** — config + state ([`backup-restore.md`](backup-restore.md)).
2. **Stage** new artefacts (packages/images) without cutting traffic yet.
3. **Migrate** data if required by the release (Alembic policy when applicable).
4. **Roll** instances using your deployment topology ([`../architecture/deployment.md`](../architecture/deployment.md)).
5. **Verify** health, audit continuity, and Kea integration behaviour.

## Rollback

Rollback expectations are release-specific. If downgrade scripts are not supported, restore from backup taken at the previous version.

## Cross-refs

- [`../architecture/versioning.md`](../architecture/versioning.md)
- [`../architecture/cicd.md`](../architecture/cicd.md)
