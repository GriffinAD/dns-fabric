# Runbooks — per failure mode

Each runbook assumes you have access to logs, metrics, and (where applicable)
the admin API. Follow [`../troubleshooting.md`](../troubleshooting.md) first.

| Runbook | When to use |
| --- | --- |
| [Plugins diagnostics](plugins-diagnostics.md) | Read `GET /api/v1/plugins`, scan issues, deps, lifecycle, install records. |
| [Plugin quarantined](plugin-quarantined.md) | Manifest/schema/hash/deps failed validation. |
| [Kea Control Agent unreachable](kea-control-agent-unreachable.md) | Kea integration errors, timeouts, TLS/auth failures. |
| [Policy denied or pending approval](policy-denied-or-pending-approval.md) | Expected action blocked by policy or waiting on approval. |
| [Warm-standby failover](warm-standby-failover.md) | Role transitions, replication health, split-brain risk. |
