# Invariant block template

Copy-paste this block into any Tier A or Tier B doc. The ID must be unique
across the repo and indexed in `docs/architecture/invariants.md` before the
doc flips to `Accepted`.

```markdown
### INV-<AREA>-<NAME>

- **Statement:** <one declarative sentence. Present tense. Falsifiable.>
- **Rationale:** <why this invariant exists — the property of the system it preserves.>
- **Enforcement:** <how the invariant is upheld at runtime or build time — contract, type, policy, CI check, etc.>
- **Test hook:** <the specific unit/contract/integration test that would fail if the invariant were violated.>
- **Back-links:** <docs, ADRs, specs, or code paths that depend on this invariant.>
```

## ID naming

- Format: `INV-<AREA>-<NAME>`
- `<AREA>` is one of the established areas: `CORE`, `PLUGIN`, `CONTRACT`,
  `EVENT`, `API`, `UI`, `SEC`, `OBS`, `MARKET`, `KEA`, `NEBULA`, `SCHED`,
  `DISCO`, `DATA`, `CONFIG`, `BROKER`, `PERF`, `REL`, `I18N`.
- `<NAME>` is `SCREAMING_SNAKE_CASE` and describes the invariant, not its
  enforcement. Good: `INV-DATA-ORM-BOUNDARY`. Bad: `INV-DATA-CI-CHECK-01`.

## Worked example

```markdown
### INV-DATA-ORM-BOUNDARY

- **Statement:** Plugin contracts never accept or return ORM objects; plugin boundaries exchange DTOs only.
- **Rationale:** Keeps plugins independent of the fabric's persistence choices and prevents lazy-loading leaks across contract boundaries.
- **Enforcement:** Contract Protocols forbid ORM types; repository classes translate at the boundary; a CI import-boundary check fails if any plugin module imports `sqlalchemy` transitively.
- **Test hook:** `tests/contracts/test_orm_boundary.py::test_no_orm_in_plugin_exports`.
- **Back-links:** `docs/architecture/data.md`, ADR-0032.
```
