# Testing — plugins

## Layers

| Layer | Focus |
| --- | --- |
| Unit | Pure logic, manifest parsing helpers, small adapters. |
| Contract | Conformance against published Protocols and schema artefacts in `specs/`. |
| Integration | Plugin loaded in a harness with fake `PluginContext`, event bus, scheduler (per architecture testing doc). |

## Requirements

- Contract tests must run in CI for every contribution type your plugin exposes.
- Fakes shipped for plugin authors should mirror the semantics documented in
  [`../architecture/testing.md`](../architecture/testing.md).

## Failure injection

Exercise validation failure (`quarantined`), dependency mismatch (`disabled`),
and broker denial paths — not only happy paths.

## Cross-refs

- [`../architecture/testing.md`](../architecture/testing.md)
- [`contracts-cookbook.md`](contracts-cookbook.md)
- [`../architecture/plugins.md`](../architecture/plugins.md)
