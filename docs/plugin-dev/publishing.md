# Publishing — plugins (local lifecycle)

## Scope

Kea Fabric roadmap phases **1–5** use **local plugin distribution only** (operator-drop,
config-declared enablement). There is **no** remote catalog, browse UI, or
network install in this phase. See [`../architecture/marketplace.md`](../architecture/marketplace.md) and [`../architecture/future-considerations.md`](../architecture/future-considerations.md).

## What “publishing” means here

1. **Package** the plugin artefact (layout per marketplace doc).
2. **Verify** manifest, hashes, SBOM expectations, and dependency closure.
3. **Deliver** to operators via your org’s existing artefact channels (not Kea Fabric’s marketplace network stack).
4. **Document** upgrade and rollback steps for operators ([`../operator/upgrade.md`](../operator/upgrade.md)).

## Versioning

Follow [`../architecture/versioning.md`](../architecture/versioning.md). Breaking manifest or contract changes require a major bump and migration notes.

## Cross-refs

- [`manifest-reference.md`](manifest-reference.md)
- [`../architecture/release-process.md`](../architecture/release-process.md)
