# Contracts cookbook — plugins

## Principles

1. **Contracts over coupling** — call through typed Protocol surfaces and
   broker-mediated operations described in [`../architecture/contracts.md`](../architecture/contracts.md).
2. **No ORM across boundaries** — plugin contracts use DTOs; see
   [`../architecture/data.md`](../architecture/data.md) and `INV-DATA-ORM-BOUNDARY`
   in [`../architecture/invariants.md`](../architecture/invariants.md).
3. **Semantic UI ids** — use `<kf-icon>` semantic ids from the shell; never ship raw SVG across the plugin boundary ([`../architecture/ui-icons.md`](../architecture/ui-icons.md)).

## Patterns

### Calling a broker-backed capability

- Resolve intent to a **permission** + **policy** decision before execution.
- Expect **audit** records for mutating or sensitive operations.
- Map failures to the platform error taxonomy ([`../architecture/error-taxonomy.md`](../architecture/error-taxonomy.md)).

### Publishing events

- Use the event envelope and namespace rules from [`../architecture/events.md`](../architecture/events.md).
- Classify durability tier explicitly; do not assume cross-node delivery in warm-standby.

### Kea operations

- Go through the Kea integration contract — no direct Control Agent clients
  inside plugins unless the contract explicitly allows that shape.

## Anti-patterns

- Importing `kea_fabric.core.*` implementation modules not exposed as contracts.
- Writing outside the plugin data directory contract.
- Bypassing brokers for filesystem, exec, HTTP, or secrets.

## Cross-refs

- [`../architecture/brokers.md`](../architecture/brokers.md)
- [`../architecture/security.md`](../architecture/security.md)
- [`testing.md`](testing.md)
