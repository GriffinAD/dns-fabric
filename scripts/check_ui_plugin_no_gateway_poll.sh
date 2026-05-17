#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_DIR="$ROOT/apps/ui/src/lib/plugins"
violations="$(
  if command -v rg >/dev/null 2>&1; then
    rg -n "setInterval\\(" "$PLUGIN_DIR" --glob '!**/*.test.ts' || true
  else
    grep -R --include='*.ts' --include='*.svelte' -n "setInterval(" "$PLUGIN_DIR" \
      | grep -vE '\.(test|spec)\.(ts|svelte):' || true
  fi
)"
if [[ -n "$violations" ]]; then
  echo "check_ui_plugin_no_gateway_poll: plugins must not poll; use FabricEventBus"
  echo "$violations"
  exit 1
fi
echo "check_ui_plugin_no_gateway_poll: OK"
