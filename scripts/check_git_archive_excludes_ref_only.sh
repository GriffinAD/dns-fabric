#!/usr/bin/env bash
# Ensure REF_ONLY is export-ignored so release archives never ship reference trees.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
if [[ ! -f .gitattributes ]]; then
  echo "missing .gitattributes (expected REF_ONLY export-ignore rules)" >&2
  exit 1
fi
if ! grep -qE 'REF_ONLY/.*export-ignore|REF_ONLY/\*\*.*export-ignore' .gitattributes; then
  echo ".gitattributes must mark REF_ONLY/** as export-ignore" >&2
  exit 1
fi
