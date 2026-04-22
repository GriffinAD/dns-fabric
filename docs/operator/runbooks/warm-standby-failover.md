# Runbook — warm-standby failover

## Symptoms

- Primary unhealthy; replication lag high; split-brain risk signals from Nebula or Fabric health.
- Operator intends to promote standby or recover from partial failure.

## Preconditions

- You have followed deployment topology docs ([`../../architecture/deployment.md`](../../architecture/deployment.md)).
- Nebula Sync behaviour is scoped to Kea config sync — not Kea Fabric state ([`../../architecture/nebula-sync.md`](../../architecture/nebula-sync.md)).

## Gather evidence

1. Replication/health signals for Fabric state and Kea surfaces.
2. Fencing posture (observe-only vs future modes per ADR).
3. Recent changes to VIP/LB or network partitions.

## Mitigation (high level)

1. **Stop making forward progress** on conflicting writes until roles are clear.
2. Follow the promoted reconciliation path documented for your topology (no third-party control-plane dependency).
3. After promotion, run post-failover smoke tests and verify event durability class behaviour ([`../../architecture/events.md`](../../architecture/events.md)).

## Escalation

If promotion cannot be made safe, freeze changes and engage architecture/security stakeholders per [`../../architecture/threat-model.md`](../../architecture/threat-model.md).
