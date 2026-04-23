#!/usr/bin/env bash
# UI engine guard: plugin-id equality checks belong in lib/plugins/ (registry/settings), not the dashboard host.
# Phase 0–1: informational only (exit 0). Phase 8: set ENFORCE_UI_PLUGIN_GUARD=1 in CI to fail on violations.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UI_SRC="$ROOT/apps/ui/src"
# Match strict pluginId comparisons outside plugins (dashboard, App, etc.)
PATTERN='pluginId ==='
matches="$(grep -R --include='*.svelte' --include='*.ts' -n "$PATTERN" "$UI_SRC" 2>/dev/null | grep -v '/lib/plugins/' || true)"
if [[ -z "${matches// }" ]]; then
  count=0
else
  count="$(printf '%s\n' "$matches" | grep -cve '^[[:space:]]*$' || true)"
fi
echo "ui-plugin-guard: occurrences of ${PATTERN} outside apps/ui/src/lib/plugins/: ${count}"
if [[ -n "$matches" ]]; then
  echo "$matches"
fi
if [[ "${ENFORCE_UI_PLUGIN_GUARD:-}" == "1" && "$count" -gt 0 ]]; then
  echo "ui-plugin-guard: FAILED (set ENFORCE_UI_PLUGIN_GUARD=1)"
  exit 1
fi
exit 0
