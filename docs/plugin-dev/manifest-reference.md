# Plugin manifest reference (v1)

## Status

**Proposed.** The canonical machine-readable definition is
`specs/manifest/plugin-manifest.schema.json` (seeded by the `specs-seed`
architecture-plan todo). This page describes field semantics for humans; if
prose and schema disagree, **the schema wins** — update this doc in the same
change set.

## Purpose

The manifest tells Kea Fabric what the plugin is, what it requires, and what
it contributes. Loaders validate the manifest before enablement.

## Documented fields (outline)

When the schema lands, each field below will link to a JSON Pointer or
`$defs` entry. Until then, treat this as a **checklist** for authors.

| Area | Topics |
| --- | --- |
| Identity | Plugin id, display name, version (semver), authors. |
| Requirements | `requires_core`, `requires_plugins`, minimum Kea Fabric / Kea assumptions. |
| Contributions | Declared capabilities, routes, UI mounts, data namespaces — all explicit. |
| Integrity | Content hash expectations, SBOM pointer when required by marketplace doc. |
| Lifecycle | Default enablement hints (operator still controls enablement in config). |

## Generation note

Long term, **tables in this file may be partially generated** from the JSON
Schema (OpenAPI-style). The source of truth remains `specs/manifest/`.

## Cross-refs

- [`../architecture/plugins.md`](../architecture/plugins.md)
- [`../architecture/marketplace.md`](../architecture/marketplace.md)
- [`publishing.md`](publishing.md)
