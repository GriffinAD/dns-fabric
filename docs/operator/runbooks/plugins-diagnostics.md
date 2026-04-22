# Runbook — plugins diagnostics

## When to use

- The operator UI **Plugins** route (`#/plugins`) shows unexpected totals, lifecycle states, or empty tables.
- You need to reconcile **discovered** bundles vs **persisted install metadata**.

## API and UI

- **`GET /api/v1/plugins`** returns the full operator snapshot. The same fields power the UI shell (see [`../../../apps/ui/README.md`](../../../apps/ui/README.md) in the repository).
- **`plugins[]`**: one entry per discovered package directory under `plugins_dir` (after host load). Each row includes **`id`**, **`version`**, **`path`**, **`content_sha256`**, and **`lifecycle`** (`state`, optional `detail`).
- **`issues[]`**: scan-time problems (e.g. unreadable manifest) with **`path`** and **`detail`**. These are not necessarily tied to a valid `plugins[]` row.
- **`dependency_errors[]`**: strings from the dependency resolver (missing `requires_plugins`, unsatisfied semver, etc.).
- **`core_requirement_satisfied`**: whether every manifest’s `requires_core` range is satisfied by the running Fabric core (PEP 440).
- **`install_records`**: map of plugin id → persisted record from `plugin-install-state.json` under **`data_dir`** (manifest version, recorded content hash, path). Empty until the host has written install state.

## Triage order

1. Confirm **`plugins_dir`** and **`data_dir`** in process metadata (`GET /api/v1/meta`) match expectations.
2. If **`issues`** is non-empty: fix manifests or filesystem permissions on the listed paths; pick up changes by restarting the process or using your normal reload path.
3. If **`dependency_errors`** is non-empty: add missing peer bundles or adjust `requires_plugins` / versions in manifests so the discovered set is consistent.
4. If **`core_requirement_satisfied`** is false: upgrade/downgrade the Fabric core or relax `requires_core` in manifests (within your change policy).
5. If **`plugins[].lifecycle.state`** is **`failed`** (or non-running when you expect **`running`**): read **`lifecycle.detail`** and host logs for import/setup errors.
6. Compare **`content_sha256`** in **`plugins[]`** vs **`install_records`** for the same id: mismatches usually mean the bundle changed on disk after install state was recorded (re-verify or clear install state per your operational policy).

## Cross-refs

- [Plugin quarantined](plugin-quarantined.md)
- [Install](../install.md) — example `plugins_dir` and local dev.
- [Configure](../configure.md) — environment and config layers.
