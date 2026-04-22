#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
npx cspell lint --no-progress "docs/**/*.md" ".cursor/**/*.mdc"
