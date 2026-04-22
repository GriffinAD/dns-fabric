# Runbook — plugin quarantined

## Symptoms

- Plugin lifecycle shows `quarantined` or refuses `enabled`.
- Audit/events cite manifest validation, hash mismatch, or dependency failure.

## Gather evidence

1. Plugin id and version from config and discovery path.
2. Validation error details from logs (redacted as per sensitive flags).
3. Expected hash/SBOM/manifest fields vs on-disk artefact.

## Mitigation

1. **Do not** force-enable without resolving root cause.
2. Replace the artefact with a known-good build; re-verify hash recorded in install record ([`../../architecture/marketplace.md`](../../architecture/marketplace.md)).
3. If dependency unsatisfied, install/enable required plugins or adjust manifest bounds.
4. Re-run validation; transition toward `validated` → `enabled` only after clean validation.

## Escalation

If validation contradicts a trusted build pipeline, treat as supply-chain incident ([`../../architecture/threat-model.md`](../../architecture/threat-model.md)).
