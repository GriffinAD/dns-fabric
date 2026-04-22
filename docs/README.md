# Kea Fabric Documentation

> **Docs-first** by policy. **Phase 1** (documentation programme) is **complete**
> — Gate 1, Gate 2, and the Rolling baseline are satisfied; see
> [`architecture/README.md`](./architecture/README.md) §"Phase 1 documentation
> programme — complete". **Phase 2** (`ADR-0033`), **Phase 3** (`ADR-0034`),
> **Phase 4** (`ADR-0035`), **Phase 5** (`ADR-0036`), and **Phase 6**
> (`ADR-0037`) implementation milestones are closed. **Phase 7** is also closed
> (implemented per `ADR-0038` scope), see **`ADR-0039`**. **Phase 8** (optional
> HS256 JWT bearer verification) is closed — see **`ADR-0041`** / **`ADR-0040`**.
> **Phase 9a** (observability / scheduler / discovery **spec catalog**) is closed
> — see **`ADR-0042`**. **Phase 9b** (runtime for those domains) is closed — see
> **`ADR-0043`** / **`ADR-0044`**. This index remains the map as Rolling docs evolve
> with implementation.

## Directory map

| Path | Purpose |
| --- | --- |
| `_governance/` | Cross-cutting governance docs: peer-reviewer protocol, product naming. |
| `_templates/` | Canonical skeletons (Tier A/B/C, ADR/MADR, invariant block). Start here. |
| `architecture/` | The architecture document set (Tier A + Tier B + Tier C). |
| `adr/` | Architecture Decision Records in MADR format. |
| `plugin-dev/` | Tier D — plugin-developer handbook ([index](./plugin-dev/README.md)). |
| `operator/` | Tier D — operator runbooks ([index](./operator/README.md)). |

The MkDocs site (`mkdocs.yml` at the repository root) lists every published page
except `_templates/` (excluded from the build). Update `nav` when you add a new
`docs/**/*.md` file so `mkdocs build --strict` stays clean.

CI also enforces **markdownlint-cli2** and **cspell** on the published doc
corpus (and Cursor rules under `.cursor/`), excluding `REF_ONLY/`. After the
MkDocs build, **lychee** runs the same corpus in **advisory** mode (reports
broken links; does not fail the workflow). For a broader local sweep (markdown,
cspell, Python compile, advisory **lychee**), use `npm run ci:docs-local` after
`npm install`. Commands and order match **AGENTS.md** (repository root)
**Build / CI (current)** and the repo-root **README.md** **Documentation site** section.

Separately, **`.github/workflows/security.yml`** runs blocking **gitleaks**,
**Syft** (CycloneDX SBOM + artifact), and **Grype** (`--fail-on high`) — see
**AGENTS.md** at the repository root.

## Architecture document set — accepted map

### Tier A (foundational, Gate 1) — accepted

- `architecture/README.md`
- `architecture/glossary.md`
- `architecture/principles.md`
- `architecture/overview.md`
- `architecture/invariants.md`
- `architecture/threat-model.md`

### Tier B - core set (Gate 1) — accepted

- `architecture/core-runtime.md`
- `architecture/plugins.md`
- `architecture/contracts.md`
- `architecture/events.md`
- `architecture/api.md`
- `architecture/ui.md`
- `architecture/security.md`
- `architecture/kea-integration.md`
- `architecture/data.md`
- `architecture/config.md`
- `architecture/brokers.md`

### Tier B - Gate 2 set — accepted

- `architecture/observability.md`
- `architecture/marketplace.md`
- `architecture/nebula-sync.md`
- `architecture/scheduler.md`
- `architecture/discovery.md`

### Tier C - Rolling (baseline accepted; evolves with implementation)

- `architecture/versioning.md`
- `architecture/error-taxonomy.md`
- `architecture/concurrency-model.md`
- `architecture/testing.md`
- `architecture/packaging.md`
- `architecture/cicd.md`
- `architecture/deployment.md`
- `architecture/release-process.md`
- `architecture/i18n.md`
- `architecture/performance.md`
- `architecture/data-governance.md`
- `architecture/platform-support.md`
- `architecture/future-considerations.md`
- `architecture/ui-design-system.md`
- `architecture/ui-themes.md`
- `architecture/ui-icons.md`
- `architecture/ui-fonts.md`
- `architecture/ui-assets.md`

### Standards + ledger (Gate 1)

- [`architecture/DOC_STANDARDS.md`](./architecture/DOC_STANDARDS.md) — the
  Documentation Quality Bar. Every architecture doc, every ADR, every
  governance note cites this file. Status: Accepted (2026-04-19).
- `architecture/reference-ledger.md` — REF_ONLY/ ↔ ported-or-dropped
  mapping. Every ported row carries the mandatory `Delta:` field.

## Reading order for a new contributor

1. The repo-root [`AGENTS.md`](../AGENTS.md).
2. `architecture/README.md` + `architecture/glossary.md` + `architecture/principles.md`.
3. `architecture/overview.md` + `architecture/invariants.md` + `architecture/threat-model.md`.
4. Pick the Tier B doc matching your area.
5. Cross-reference ADRs as they are cited.
6. [`plugin-dev/`](./plugin-dev/README.md) or [`operator/`](./operator/README.md) when building plugins or running the system.
