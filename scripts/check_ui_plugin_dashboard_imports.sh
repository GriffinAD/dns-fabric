#!/usr/bin/env bash
# UI engine: plugins may only import ../dashboard/types and ../dashboard/eventBus
# (keeps dashboard host internals out of plugin tiles).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGINS="$ROOT/apps/ui/src/lib/plugins"
violations=""
while IFS= read -r hit; do
  [[ -z "${hit}" ]] && continue
  line="${hit#*:}"
  line="${line#*:}"
  if echo "${line}" | grep -qE 'from[[:space:]]+['\''\"][^'\''\"]*dashboard/(types|eventBus)['\''\"]'; then
    continue
  fi
  if echo "${line}" | grep -qE '\.\./dashboard/'; then
    violations="${violations}${hit}"$'\n'
  fi
done < <(grep -R -n --include='*.ts' --include='*.svelte' '\.\./dashboard/' "${PLUGINS}" 2>/dev/null || true)

if [[ -n "${violations// }" ]]; then
  echo "check:ui-plugin-dashboard-imports: plugins may only import ../dashboard/types and ../dashboard/eventBus"
  printf '%s' "${violations}"
  exit 1
fi
echo "check:ui-plugin-dashboard-imports: OK (plugins → dashboard: types | eventBus only)"
exit 0
