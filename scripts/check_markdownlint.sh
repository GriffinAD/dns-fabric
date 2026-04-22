#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
npx markdownlint-cli2 "docs/**/*.md" ".cursor/**/*.mdc" "!**/REF_ONLY/**"
