# Runbook — Kea Control Agent unreachable

## Symptoms

- Kea operations fail with connectivity/timeouts from Kea Fabric.
- Health checks report degraded Kea integration.

## Gather evidence

1. Network path from Kea Fabric host to Kea Control Agent host/port.
2. TLS trust chain and client credentials (if any).
3. Kea CA logs and Kea Fabric logs around the same timestamp.
4. Firewall and DNS changes in the change window.

## Mitigation

1. Restore network reachability (route, security group, local firewall).
2. Fix TLS trust or rotate credentials per your PKI policy.
3. Confirm Kea version floor still met ([`../../architecture/kea-integration.md`](../../architecture/kea-integration.md)).
4. Re-run a read-only Kea command to validate before attempting mutations.

## Escalation

If Kea is healthy but Fabric still cannot integrate, capture broker error mapping and open a defect with redacted traces.
