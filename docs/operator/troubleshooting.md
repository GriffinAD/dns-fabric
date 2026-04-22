# Troubleshooting

## Triage flow

```mermaid
flowchart TD
    accTitle: Operator triage
    accDescr: Start from health and logs, then narrow to Kea, plugins, or policy.
    H[Health check fails] --> L[Logs + metrics]
    L --> K{Kea CA reachable?}
    K -->|no| R1[Runbook: Kea Control Agent unreachable]
    K -->|yes| P{Plugin state?}
    P -->|quarantined| R2[Runbook: Plugin quarantined]
    P -->|ok| A{Policy/approval?}
    A -->|denied/pending| R3[Runbook: Policy denied or pending approval]
    A -->|ok| S[Subsystem-specific docs]
```

## Symptom index

| Symptom | First checks | Runbook |
| --- | --- | --- |
| API 503 / degraded health | Recent deploy, resource limits, dependency down | [`runbooks/warm-standby-failover.md`](runbooks/warm-standby-failover.md) if clustered |
| Kea commands fail | CA URL, TLS, auth, Kea logs | [`runbooks/kea-control-agent-unreachable.md`](runbooks/kea-control-agent-unreachable.md) |
| Plugin will not enable | Manifest validation, dependency closure | [`runbooks/plugin-quarantined.md`](runbooks/plugin-quarantined.md) |
| Plugins UI or API looks wrong | `GET /api/v1/plugins`, scan issues, deps, install records | [`runbooks/plugins-diagnostics.md`](runbooks/plugins-diagnostics.md) |
| Action blocked | Permissions, policy, approval queue | [`runbooks/policy-denied-or-pending-approval.md`](runbooks/policy-denied-or-pending-approval.md) |

## Cross-refs

- [`../architecture/observability.md`](../architecture/observability.md)
- [`runbooks/README.md`](runbooks/README.md)
