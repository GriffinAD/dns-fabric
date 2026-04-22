# Getting started — plugin development

## Audience

Engineers building Kea Fabric plugins: extensions that ship a manifest,
declare contributions, and run inside the plugin runtime described in
[`../architecture/plugins.md`](../architecture/plugins.md).

## Prerequisites

- Read [`../architecture/glossary.md`](../architecture/glossary.md) — especially **plugin**, **contribution**, **contract**, and **broker**.
- Confirm your target Kea Fabric version and Kea floor from [`../architecture/platform-support.md`](../architecture/platform-support.md) and [`../architecture/kea-integration.md`](../architecture/kea-integration.md).

## What a plugin is

A **plugin** is a versioned unit with:

1. A **manifest** (validated against the JSON Schema in `specs/` when seeded).
2. **Declared contributions** — nothing implicit; the platform loads only what the manifest describes.
3. A bounded **contract surface** — interactions go through published contracts and audited brokers, not ad-hoc imports of core internals.

## Local development workflow (conceptual)

1. Author manifest + plugin package layout per [`manifest-reference.md`](manifest-reference.md).
2. Place artefacts under the operator-configured plugin discovery path (see marketplace architecture).
3. Enable the plugin ID in configuration; validate lifecycle transitions (`discovered` → `validated` → `enabled`, etc.).
4. Run tests using the patterns in [`testing.md`](testing.md).

## Cross-refs

- [`manifest-reference.md`](manifest-reference.md)
- [`contracts-cookbook.md`](contracts-cookbook.md)
- [`../architecture/plugins.md`](../architecture/plugins.md)
