#!/usr/bin/env bash
# Application gate (mirrors .github/workflows/python.yml).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
uv sync --extra dev --locked
bash scripts/compile_python_tree.sh
uv run ruff check src tests scripts
uv run mypy src tests
uv run pytest --cov=kea_fabric --cov-report=term-missing -q
uv run python scripts/check_layout_parity.py
uv run python scripts/check_openapi_drift.py
uv run python scripts/validate_specs.py
uv build
uv run python scripts/check_release_artifacts.py
