#!/usr/bin/env bash
# Byte-compile product Python, tests, automation scripts, and contract stubs.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
uv run python -m compileall -q src tests
[[ -d scripts ]] && uv run python -m compileall -q scripts
[[ -d specs/contracts ]] && uv run python -m compileall -q specs/contracts
