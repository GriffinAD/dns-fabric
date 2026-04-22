# Install

## Prerequisites

- Supported platform per [`../architecture/platform-support.md`](../architecture/platform-support.md).
- ISC Kea at or above the documented floor ([`../architecture/kea-integration.md`](../architecture/kea-integration.md)).
- Network and firewall plan for API/UI access and Kea Control Agent reachability.

## Packaging surfaces

Kea Fabric will ship via native packages, containers, and Helm ([`../architecture/packaging.md`](../architecture/packaging.md)). Pick the artefact that matches your environment; the same configuration model applies across surfaces ([`configure.md`](configure.md)).

## First boot (conceptual)

1. Install the package or deploy the container/chart.
2. Place configuration under the precedence order in [`configure.md`](configure.md).
3. Verify health endpoints and logs ([`../architecture/observability.md`](../architecture/observability.md)).
4. Confirm Kea Fabric → Kea connectivity before enabling plugins.

## Building from source and verifying wheels

For maintainers packaging from a git checkout:

1. Sync the dev environment: `uv sync --extra dev --locked`.
2. Produce sdist + wheel: `uv build` (outputs under `dist/`).
3. Confirm filenames and sizes: `uv run python scripts/check_release_artifacts.py`
   (expects `kea_fabric-<version>.tar.gz` and the matching `py3-none-any.whl` for
   `src/kea_fabric/__init__.py::__version__`).

The same check is available via `npm run check:release-artifacts` from the repo
root when `uv` is on your `PATH`.

## Local development with example plugins

The in-tree reference bundles under `plugins/examples/` (repository root) are
not used automatically: the default `plugins_dir` points at
`/var/lib/kea-fabric/plugins`. To load those examples when running
`kea-fabric serve`, point `KEA_FABRIC_PLUGINS_DIR` at the examples tree and use a
writable `KEA_FABRIC_DATA_DIR` for install records (paths are resolved relative
to the process working directory if not absolute):

```bash
export KEA_FABRIC_PLUGINS_DIR="$PWD/plugins/examples"
export KEA_FABRIC_DATA_DIR="$PWD/.fabric-data"
mkdir -p "$KEA_FABRIC_DATA_DIR"
uv run kea-fabric serve --reload
```

Equivalent helper (fixed `127.0.0.1:8080`, with `--reload` for local iteration):
run `bash scripts/dev_serve_with_examples.sh` from the repository root.

See the repository file `plugins/examples/README.md` for a short description of
each bundle. The operator UI’s **Plugins** view lists discovered packages
(id, version, lifecycle state, optional detail) and running counts from
`GET /api/v1/plugins`.

For field-by-field interpretation and triage, see
[`runbooks/plugins-diagnostics.md`](runbooks/plugins-diagnostics.md).

## Cross-refs

- [`../architecture/deployment.md`](../architecture/deployment.md)
- [`configure.md`](configure.md)
