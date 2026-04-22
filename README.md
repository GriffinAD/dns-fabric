# Kea Fabric

Management plane for ISC Kea DHCP — documentation-first repository with runtime
and operator UI scaffolding.

## Documentation site

```bash
npm install
uv sync --extra docs --locked
uv run mkdocs serve --strict
```

CI runs `mkdocs build --strict` (see `.github/workflows/docs.yml`).

## Application gate (Python)

```bash
uv sync --extra dev --locked
bash scripts/check_app.sh
```

## Operator UI

```bash
npm --prefix apps/ui ci
npm run check:ui-unit
npm run check:ui-e2e
```

See [docs/operator-demo.md](docs/operator-demo.md) for the full local demo path.

## Contributing

- [AGENTS.md](AGENTS.md) — automation and repo conventions.
- [docs/_governance/NAMING.md](docs/_governance/NAMING.md) — product naming.
