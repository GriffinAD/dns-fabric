# Runbook — policy denied or pending approval

## Symptoms

- API returns forbidden / policy denial, or action stuck pending approval.
- Audit shows policy evaluation outcome but no successful broker execution.

## Gather evidence

1. Actor identity and trust context for the request.
2. Required permissions vs granted permissions for the capability.
3. Whether the change requires approval workflow ([`../../architecture/security.md`](../../architecture/security.md)).
4. Recent policy or role changes.

## Mitigation

1. If **pending approval**: route through the operator approval workflow; do not bypass brokers.
2. If **denied**: adjust policy/roles per least-privilege, or split the action into allowed steps.
3. If **misconfigured policy**: fix config and reload per reload tags ([`../configure.md`](../configure.md)).

## Escalation

If policy outcomes look incorrect for the same inputs, treat as a policy-engine defect and capture reproducible minimal request (redacted).
