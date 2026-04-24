# Agent / contributor notes

## Build / CI (current)

| Lane | Command / workflow |
| --- | --- |
| Python | `bash scripts/check_app.sh` — mirrors `.github/workflows/python.yml` |
| Docs | `npm install` then `bash scripts/check_markdownlint.sh`, `bash scripts/check_cspell.sh`, `uv sync --extra dev --extra docs --locked`, `uv run mkdocs build --strict` |
| UI | `npm --prefix apps/ui ci`, `npm run check:ui-unit`, `npm run check:ui-e2e` |
| Security | `.github/workflows/security.yml` — gitleaks, Syft SBOM, Grype |

## Git

- Local identity and DCO: see `.cursor/rules/commits.mdc`.
- Hooks: `git config core.hooksPath .githooks`
- **Remotes:** **`origin`** → **`GriffinAD/kea-fabric`** (product). **`poc`** → **`GriffinAD/kea-fabric-poc`** (optional). See [README.md](README.md) **Git remotes** and [docs/_governance/NAMING.md](docs/_governance/NAMING.md).

## Coverage

- Target **100%** line coverage; CI enforces **100%** on covered paths (`fail_under` / Vitest) — [docs/architecture/testing.md](docs/architecture/testing.md).
