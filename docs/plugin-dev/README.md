# Plugin developer handbook

> Tier D — may trail the core architecture set. These guides assume you have
> read [`../architecture/README.md`](../architecture/README.md),
> [`../architecture/plugins.md`](../architecture/plugins.md), and
> [`../architecture/contracts.md`](../architecture/contracts.md).

## Contents

| Doc | Purpose |
| --- | --- |
| [Getting started](getting-started.md) | Environment, repo layout expectations, first plugin skeleton. |
| [Manifest reference](manifest-reference.md) | Plugin manifest v1 — field semantics (schema lives in `specs/` when seeded). |
| [Contracts cookbook](contracts-cookbook.md) | How to consume and publish contracts from a plugin. |
| [Testing](testing.md) | Unit, contract, and integration testing for plugins. |
| [Publishing](publishing.md) | Packaging, versioning, and operator hand-off (local lifecycle; no remote catalog in roadmap phases 1–5). |

## Related architecture

- [`../architecture/marketplace.md`](../architecture/marketplace.md) — local artefact model.
- [`../architecture/security.md`](../architecture/security.md) — trust and policy.
- [`../adr/README.md`](../adr/README.md) — ADRs governing plugin distribution and isolation.
