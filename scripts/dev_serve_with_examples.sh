#!/usr/bin/env bash
# Local operator API for docs/operator-demo.md (mock Kea/Nebula; durable layout under KEA_FABRIC_DATA_DIR).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec uv run kea-fabric-api
