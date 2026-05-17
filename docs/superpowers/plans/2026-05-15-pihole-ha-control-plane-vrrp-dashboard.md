# Pi-hole HA control plane — VRRP in dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export authoritative **Keepalived VRRP role** (MASTER / BACKUP / FAULT) from each Pi node into `GET /dashboard` `sections.keepalived.vrrp` and render it in the **pi-fabric** operator UI so the orange “not available in container” warning is replaced by live role when configured.

**Architecture:** Keepalived continues to run on the **host** (`systemd`). **Notify scripts** (`on-master.sh`, `on-backup.sh`) atomically write a small **JSON state file** under `PIHOLE_HA_BASE/data/keepalived/`. The **control-plane** container bind-mounts that directory read-only and a new **`adapters/vrrp_state.py`** parses it. **`keepalived_section()`** merges file-based role with the existing **VIP TCP probe** and **LAN identity hint**. The Svelte tile shows role in neutral/green chrome when `vrrp.available === true`, and a clear degraded message only when the mount or file is missing.

**Tech stack:** Bash (notify scripts), Python 3.12 + FastAPI (`pihole-ha`), Docker Compose volume, `unittest` + CI (`validate.yml`); Svelte 5 + Vitest (`pi-fabric` `apps/ui`).

**Normative inputs:**

- `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §5.3 (Host / VIP adapter)
- `pihole-ha/docs/operations/control-plane-ui.md` (today documents the explicit gap)
- `pihole-ha/platform/keepalived/pi1.conf.template`, `pi2.conf.template` (`VI_1`, notify hooks)

**Repos:** Runtime + compose changes land in **`pihole-ha`**; UI in **`pi-fabric`**. Ship **pihole-ha first** so `/dashboard` JSON is correct before rebuilding the embedded UI bundle.

---

## Why not parse Keepalived internals directly?

| Approach | Verdict |
|----------|---------|
| D-Bus / UNIX stats socket inside container | Fragile across Keepalived versions; extra caps; not in current compose |
| Parse `/run/keepalived/*` binary state | Undocumented on-disk format; differs by distro |
| **`kill -USR2` → `/tmp/keepalived.stats`** | Requires signal to host PID; awkward from container |
| **Notify scripts write JSON under `PIHOLE_HA_BASE/data/`** | Matches existing **`on-master.sh` / `on-backup.sh`** ops path; read-only mount; testable |

**Corroboration (optional follow-up, not required for MVP):** compare `role` with “VIP assigned on `KEEPALIVED_INTERFACE`” using host network introspection (same idea as `ops/runtime/failover/is-master.sh`). If they disagree, surface `vrrp.warning` in JSON — defer unless timeboxed.

---

## Contract: `sections.keepalived.vrrp`

Stable JSON shape (additive; do not remove existing keys):

```json
{
  "available": true,
  "role": "MASTER",
  "instance": "VI_1",
  "source": "notify_state_file",
  "state_file": "/ro/keepalived-state/vrrp-state.json",
  "updated_at": "2026-05-15T18:30:00+00:00",
  "detail": null
}
```

When unavailable:

```json
{
  "available": false,
  "role": null,
  "instance": null,
  "source": null,
  "state_file": null,
  "updated_at": null,
  "detail": "Host VRRP state file not mounted or not yet written (Keepalived notify)."
}
```

**File on host** (`$PIHOLE_HA_BASE/data/keepalived/vrrp-state.json`), version **1**:

```json
{
  "version": 1,
  "instance": "VI_1",
  "role": "MASTER",
  "event": "notify_master",
  "vip": "192.168.2.2",
  "vip_prefix_len": 24,
  "interface": "eth0",
  "node": "pi2",
  "updated_at": "2026-05-15T18:30:00+00:00"
}
```

`role` ∈ `MASTER` | `BACKUP` | `FAULT` | `STOP` (pass through Keepalived notify where applicable).

---

## File map

### `pihole-ha`

| Path | Responsibility |
|------|----------------|
| `ops/lib/write-vrrp-state.sh` | Shared helper: atomic write JSON to `data/keepalived/vrrp-state.json` |
| `ops/runtime/failover/on-master.sh` | Call helper after Nebula start |
| `ops/runtime/backup/on-backup.sh` | Call helper with `BACKUP` or `FAULT` from `$3` |
| `ops/install/preflight.sh` | `mkdir -p` + ensure readable `data/keepalived/` |
| `ops/install/bootstrap.sh` | Seed initial `role: "unknown"` before first notify (optional but avoids blank dashboard on first boot) |
| `platform/core/docker-compose.control-plane.override.yml` | RO mount `data/keepalived` → `/ro/keepalived-state` |
| `platform/control-plane/app/adapters/vrrp_state.py` | Read + validate JSON; env paths |
| `platform/control-plane/app/sections/keepalived.py` | Wire adapter; remove hard-coded `available: False` |
| `platform/control-plane/spec/openapi.json` | Regenerated (dashboard schema is loose; still run drift CI) |
| `tests/test_vrrp_state.py` | Unit tests for adapter |
| `tests/test_control_plane.py` | Update `TestKeepalivedSection` |
| `docs/operations/control-plane-ui.md` | Document mount + state file |
| `docs/operations/control-plane-smoke.md` | Add VRRP smoke steps |

### `pi-fabric`

| Path | Responsibility |
|------|----------------|
| `apps/ui/src/lib/piholeCp/SectionDashboardTile.svelte` | Role display; amber only when unavailable |
| `apps/ui/src/lib/piholeCp/SectionDashboardTile.svelte.test.ts` | Tests for MASTER vs unavailable |
| `docs/operations/control-plane-ui.md` | Cross-link (if section exists) or ADR pointer |

### `dns-fabric` (docs only)

| Path | Responsibility |
|------|----------------|
| `docs/adr/ADR-0054-pihole-ha-control-plane-vrrp-read-model.md` | **New** — read-only VRRP export decision |
| `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` | §8 — mark Keepalived/VRRP backlog addressed |

---

## Phase A — `pihole-ha` host export

### Task 1: Shared `write-vrrp-state.sh`

**Files:**
- Create: `pihole-ha/ops/lib/write-vrrp-state.sh`
- Modify: `pihole-ha/ops/lib/install-wrappers.sh` (no change required unless you install the lib; scripts source by path)

- [ ] **Step 1: Add helper**

Create `ops/lib/write-vrrp-state.sh`:

```bash
#!/bin/bash
# Write VRRP role for control-plane dashboard (atomic JSON).
# Usage: write_vrrp_state.sh <ROLE> <EVENT>
# ROLE: MASTER | BACKUP | FAULT | STOP | unknown
# EVENT: notify_master | notify_backup | notify_fault | bootstrap | ...
set -euo pipefail

BASE="${PIHOLE_HA_BASE:-/opt/pihole-ha}"
ENV_FILE="$BASE/.env"
if [[ -f "$ENV_FILE" ]] && [[ -f "$BASE/ops/lib/load-env-safe.sh" ]]; then
  # shellcheck source=/dev/null
  source "$BASE/ops/lib/load-env-safe.sh"
  load_env_safe "$ENV_FILE"
fi

ROLE="${1:-unknown}"
EVENT="${2:-notify}"
DIR="$BASE/data/keepalived"
FILE="$DIR/vrrp-state.json"
TMP="$DIR/vrrp-state.json.tmp"

mkdir -p "$DIR"
NODE="${CONTROL_PLANE_NODE_NAME:-${PIHOLE_HA_NODE:-unknown}}"
VIP="${PIHOLE_VIP:-}"
PFX="${PIHOLE_VIP_PREFIX_LEN:-24}"
IFACE="${KEEPALIVED_INTERFACE:-}"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

printf '%s\n' "{
  \"version\": 1,
  \"instance\": \"VI_1\",
  \"role\": \"${ROLE}\",
  \"event\": \"${EVENT}\",
  \"vip\": \"${VIP}\",
  \"vip_prefix_len\": ${PFX},
  \"interface\": \"${IFACE}\",
  \"node\": \"${NODE}\",
  \"updated_at\": \"${TS}\"
}" >"$TMP"
mv -f "$TMP" "$FILE"
chmod 0644 "$FILE"
```

- [ ] **Step 2: Shellcheck in CI**

Run: `shellcheck ops/lib/write-vrrp-state.sh ops/runtime/failover/on-master.sh ops/runtime/backup/on-backup.sh`  
Expected: no errors (add to `validate.yml` if not already covering new file).

- [ ] **Step 3: Commit**

```bash
git add ops/lib/write-vrrp-state.sh
git commit -s -m "feat(ops): add write-vrrp-state helper for control-plane dashboard"
```

---

### Task 2: Notify scripts write state

**Files:**
- Modify: `pihole-ha/ops/runtime/failover/on-master.sh`
- Modify: `pihole-ha/ops/runtime/backup/on-backup.sh`

- [ ] **Step 1: Update `on-master.sh`**

```bash
#!/bin/bash
set -euo pipefail

BASE="${PIHOLE_HA_BASE:-/opt/pihole-ha}"
# shellcheck source=/dev/null
source "$BASE/ops/lib/write-vrrp-state.sh"
write_vrrp_state "MASTER" "notify_master"

logger -t pihole-ha "Node became MASTER"
/usr/local/bin/nebula-start.sh
```

- [ ] **Step 2: Update `on-backup.sh`**

Keepalived passes **`$3`** = `BACKUP` | `FAULT` | `STOP` for notify scripts:

```bash
#!/bin/bash
set -euo pipefail

BASE="${PIHOLE_HA_BASE:-/opt/pihole-ha}"
# shellcheck source=/dev/null
source "$BASE/ops/lib/write-vrrp-state.sh"
ROLE="${3:-BACKUP}"
if [[ "$ROLE" == "STOP" ]]; then
  ROLE="BACKUP"
fi
write_vrrp_state "$ROLE" "notify_${ROLE,,}"

logger -t pihole-ha "Node became BACKUP/FAULT ($ROLE)"
/usr/local/bin/nebula-stop.sh
```

- [ ] **Step 3: Manual smoke on a dev Pi (or skip in CI)**

```bash
sudo PIHOLE_HA_BASE=/opt/pihole-ha bash /opt/pihole-ha/ops/lib/write-vrrp-state.sh MASTER notify_master
cat /opt/pihole-ha/data/keepalived/vrrp-state.json
```

Expected: valid JSON, `"role": "MASTER"`.

- [ ] **Step 4: Commit**

```bash
git add ops/runtime/failover/on-master.sh ops/runtime/backup/on-backup.sh
git commit -s -m "feat(ops): export VRRP role from Keepalived notify scripts"
```

---

### Task 3: Preflight + bootstrap seed

**Files:**
- Modify: `pihole-ha/ops/install/preflight.sh`
- Modify: `pihole-ha/ops/install/bootstrap.sh` (end of successful bootstrap)

- [ ] **Step 1: Preflight ensures directory exists**

After other `data/` mkdir blocks in `preflight.sh`, add:

```bash
mkdir -p "${PIHOLE_HA_BASE:-/opt/pihole-ha}/data/keepalived"
```

- [ ] **Step 2: Bootstrap seeds `unknown` once**

At end of `bootstrap.sh` (after `systemctl restart keepalived`):

```bash
if [[ -x "$BASE/ops/lib/write-vrrp-state.sh" ]]; then
  bash "$BASE/ops/lib/write-vrrp-state.sh" "unknown" "bootstrap"
fi
```

- [ ] **Step 3: Commit**

```bash
git add ops/install/preflight.sh ops/install/bootstrap.sh
git commit -s -m "chore(ops): ensure keepalived state dir exists on install"
```

---

## Phase B — `pihole-ha` control-plane read path

### Task 4: `vrrp_state` adapter (TDD)

**Files:**
- Create: `pihole-ha/platform/control-plane/app/adapters/vrrp_state.py`
- Create: `pihole-ha/tests/test_vrrp_state.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_vrrp_state.py`:

```python
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from adapters import vrrp_state


class TestVrrpStateAdapter(unittest.TestCase):
    def test_missing_mount_returns_unavailable(self) -> None:
        with patch.dict(os.environ, {"CONTROL_PLANE_VRRP_STATE_FILE": "/nonexistent/vrrp-state.json"}):
            out = vrrp_state.read_vrrp_state()
        self.assertFalse(out["available"])
        self.assertIsNone(out["role"])

    def test_parses_valid_file(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "vrrp-state.json"
            path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "instance": "VI_1",
                        "role": "BACKUP",
                        "event": "notify_backup",
                        "vip": "192.168.2.2",
                        "vip_prefix_len": 24,
                        "interface": "eth0",
                        "node": "pi2",
                        "updated_at": "2026-05-15T12:00:00Z",
                    }
                ),
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"CONTROL_PLANE_VRRP_STATE_FILE": str(path)}):
                out = vrrp_state.read_vrrp_state()
        self.assertTrue(out["available"])
        self.assertEqual(out["role"], "BACKUP")
        self.assertEqual(out["instance"], "VI_1")
        self.assertEqual(out["updated_at"], "2026-05-15T12:00:00Z")

    def test_rejects_invalid_role(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "vrrp-state.json"
            path.write_text(json.dumps({"version": 1, "role": "PRIMARY"}), encoding="utf-8")
            with patch.dict(os.environ, {"CONTROL_PLANE_VRRP_STATE_FILE": str(path)}):
                out = vrrp_state.read_vrrp_state()
        self.assertFalse(out["available"])
        self.assertIn("invalid", (out.get("detail") or "").lower())
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd platform/control-plane/app && python -m unittest tests.test_vrrp_state -v`  
(from repo root, ensure `PYTHONPATH=platform/control-plane/app` per existing tests)

Expected: `ModuleNotFoundError` or `read_vrrp_state` missing.

- [ ] **Step 3: Implement adapter**

Create `platform/control-plane/app/adapters/vrrp_state.py`:

```python
"""Read Keepalived VRRP role exported by host notify scripts (read-only)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

_ALLOWED_ROLES = frozenset({"MASTER", "BACKUP", "FAULT", "STOP", "unknown"})
_DEFAULT_FILE = "/ro/keepalived-state/vrrp-state.json"


def _state_path() -> Path:
    raw = (os.environ.get("CONTROL_PLANE_VRRP_STATE_FILE") or _DEFAULT_FILE).strip()
    return Path(raw)


def read_vrrp_state() -> dict[str, Any]:
    path = _state_path()
    if not path.is_file():
        return {
            "available": False,
            "role": None,
            "instance": None,
            "source": None,
            "state_file": str(path),
            "updated_at": None,
            "detail": "Host VRRP state file not mounted or not yet written (Keepalived notify).",
        }
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {
            "available": False,
            "role": None,
            "instance": None,
            "source": None,
            "state_file": str(path),
            "updated_at": None,
            "detail": f"Could not read VRRP state file: {exc}",
        }
    if not isinstance(payload, dict):
        return {
            "available": False,
            "role": None,
            "instance": None,
            "source": None,
            "state_file": str(path),
            "updated_at": None,
            "detail": "VRRP state file is not a JSON object.",
        }
    role = str(payload.get("role") or "").strip().upper()
    if role not in _ALLOWED_ROLES:
        return {
            "available": False,
            "role": None,
            "instance": None,
            "source": None,
            "state_file": str(path),
            "updated_at": None,
            "detail": f"Invalid VRRP role in state file: {role!r}",
        }
    return {
        "available": True,
        "role": role,
        "instance": str(payload.get("instance") or "VI_1"),
        "source": "notify_state_file",
        "state_file": str(path),
        "updated_at": payload.get("updated_at"),
        "detail": None,
        "file": {
            "event": payload.get("event"),
            "vip": payload.get("vip"),
            "vip_prefix_len": payload.get("vip_prefix_len"),
            "interface": payload.get("interface"),
            "node": payload.get("node"),
        },
    }
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `python -m unittest tests.test_vrrp_state -v` (same `PYTHONPATH` as `tests/test_control_plane.py`).

- [ ] **Step 5: Commit**

```bash
git add platform/control-plane/app/adapters/vrrp_state.py tests/test_vrrp_state.py
git commit -s -m "feat(control-plane): read VRRP role from host notify state file"
```

---

### Task 5: Wire `keepalived_section` + compose mount

**Files:**
- Modify: `pihole-ha/platform/control-plane/app/sections/keepalived.py`
- Modify: `pihole-ha/platform/core/docker-compose.control-plane.override.yml`
- Modify: `pihole-ha/tests/test_control_plane.py`
- Modify: `pihole-ha/.env_example` (document env var)

- [ ] **Step 1: Update section**

Replace hard-coded `vrrp` block in `keepalived_section()`:

```python
from adapters.vrrp_state import read_vrrp_state

def keepalived_section() -> dict[str, Any]:
    ...
    return {
        "ok": True,
        "vip": vip or None,
        "tcp_dns_probe": tcp,
        "lan_identity_hint": lan_role,
        "vrrp": read_vrrp_state(),
    }
```

Update module docstring: “VIP probe + LAN hint + VRRP role from notify state file”.

- [ ] **Step 2: Compose volume**

In `platform/core/docker-compose.control-plane.override.yml` under `volumes:`:

```yaml
      - ${PIHOLE_HA_BASE:-/opt/pihole-ha}/data/keepalived:/ro/keepalived-state:ro
```

Under `environment:` (optional override):

```yaml
      CONTROL_PLANE_VRRP_STATE_FILE: ${CONTROL_PLANE_VRRP_STATE_FILE:-/ro/keepalived-state/vrrp-state.json}
```

- [ ] **Step 3: Update unit test**

Replace `test_vrrp_not_exported` with two tests:

```python
def test_vrrp_available_when_state_file_present(self) -> None:
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "vrrp-state.json"
        path.write_text(
            '{"version":1,"instance":"VI_1","role":"MASTER","updated_at":"2026-01-01T00:00:00Z"}',
            encoding="utf-8",
        )
        with patch.dict(
            os.environ,
            {
                "PIHOLE_VIP": "",
                "PIHOLE_NODE1": "",
                "PIHOLE_NODE2": "",
                "CONTROL_PLANE_VRRP_STATE_FILE": str(path),
            },
            clear=False,
        ):
            k = keepalived_mod.keepalived_section()
    self.assertTrue(k["vrrp"]["available"])
    self.assertEqual(k["vrrp"]["role"], "MASTER")

def test_vrrp_unavailable_when_state_file_missing(self) -> None:
    with patch.dict(
        os.environ,
        {
            "PIHOLE_VIP": "",
            "CONTROL_PLANE_VRRP_STATE_FILE": "/nonexistent/vrrp-state.json",
        },
        clear=False,
    ):
        k = keepalived_mod.keepalived_section()
    self.assertFalse(k["vrrp"]["available"])
```

- [ ] **Step 4: Run control-plane tests**

Run: `python -m unittest tests.test_control_plane tests.test_vrrp_state -v`

- [ ] **Step 5: Regenerate OpenAPI**

Run: `python platform/control-plane/scripts/export_openapi.py`  
Run: `cmp` drift step from `validate.yml` locally if available.

- [ ] **Step 6: Commit**

```bash
git add platform/control-plane/app/sections/keepalived.py \
  platform/core/docker-compose.control-plane.override.yml \
  tests/test_control_plane.py .env_example
git commit -s -m "feat(control-plane): expose VRRP role on dashboard keepalived section"
```

---

### Task 6: Operator docs + smoke (`pihole-ha`)

**Files:**
- Modify: `pihole-ha/docs/operations/control-plane-ui.md`
- Modify: `pihole-ha/docs/operations/control-plane-smoke.md`

- [ ] **Step 1: Document mount and upgrade path**

In `control-plane-ui.md`, replace the “not full VRRP” bullet with:

- **`sections.keepalived.vrrp`**: `role`, `instance`, `updated_at` from **`$PIHOLE_HA_BASE/data/keepalived/vrrp-state.json`**, written by **`on-master.sh` / `on-backup.sh`**, mounted at **`/ro/keepalived-state`**.
- After upgrade: reinstall wrappers (`pihole-ha-refresh`), recreate **`control-plane`** container, trigger failover once so notify refreshes the file.

- [ ] **Step 2: Smoke steps**

Add to `control-plane-smoke.md`:

```bash
cat "${PIHOLE_HA_BASE}/data/keepalived/vrrp-state.json"
curl -sS "http://127.0.0.1:${CONTROL_PLANE_UI_HOST_PORT:-8091}/dashboard" | jq '.sections.keepalived.vrrp'
```

Expected: `.available == true`, `.role` is `MASTER` or `BACKUP`.

- [ ] **Step 3: Commit**

```bash
git add docs/operations/control-plane-ui.md docs/operations/control-plane-smoke.md
git commit -s -m "docs: control-plane VRRP state file and smoke"
```

---

## Phase C — `pi-fabric` UI

### Task 7: Keepalived tile — show role when available

**Files:**
- Modify: `apps/ui/src/lib/piholeCp/SectionDashboardTile.svelte` (keepalived block ~lines 148–157)
- Modify: `apps/ui/src/lib/piholeCp/SectionDashboardTile.svelte.test.ts`

- [ ] **Step 1: Write failing UI test**

```typescript
it("renders VRRP role when available", () => {
  render(SectionDashboardTile, {
    props: {
      section: "keepalived",
      title: "VIP TCP / LAN hint",
      payload: {
        ok: true,
        vip: "192.168.2.2",
        vrrp: {
          available: true,
          role: "MASTER",
          instance: "VI_1",
          updated_at: "2026-05-15T12:00:00Z",
          detail: null,
        },
      },
    },
  });
  expect(screen.getByText("MASTER")).toBeTruthy();
  expect(screen.queryByText(/not available in container/i)).toBeNull();
});

it("shows degraded VRRP panel when unavailable", () => {
  render(SectionDashboardTile, {
    props: {
      section: "keepalived",
      title: "VIP TCP / LAN hint",
      payload: {
        ok: true,
        vrrp: {
          available: false,
          detail: "Host VRRP state file not mounted or not yet written (Keepalived notify).",
        },
      },
    },
  });
  expect(screen.getByText(/not available in container/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm --prefix apps/ui run test:unit -- src/lib/piholeCp/SectionDashboardTile.svelte.test.ts`

- [ ] **Step 3: Update Svelte**

Replace amber-only block with:

```svelte
{#if asRecord(p.vrrp)}
  {@const v = asRecord(p.vrrp)!}
  {#if boolish(v.available)}
    <div
      class="mb-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
    >
      <p class="font-medium">VRRP</p>
      <p class="mt-1">
        Role <span class="font-mono font-semibold">{str(v.role) ?? "—"}</span>
        {#if str(v.instance)} · <span class="font-mono">{str(v.instance)}</span>{/if}
      </p>
      {#if str(v.updated_at)}
        <p class="mt-1 text-emerald-900/80 dark:text-emerald-200/80">Updated {str(v.updated_at)}</p>
      {/if}
    </div>
  {:else}
    <div
      class="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <p class="font-medium">VRRP</p>
      <p class="mt-1">Not available in container</p>
      {#if typeof v.detail === "string"}
        <p class="mt-1 text-amber-900/90 dark:text-amber-200/90">{v.detail}</p>
      {/if}
    </div>
  {/if}
{/if}
```

(Use `<motion.div>` only if the file already uses `div` — match surrounding markup; **do not** introduce `motion.div` if absent.)

- [ ] **Step 4: Run UI unit + coverage**

Run: `npm run check:ui-unit` from repo root.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/piholeCp/SectionDashboardTile.svelte \
  apps/ui/src/lib/piholeCp/SectionDashboardTile.svelte.test.ts
git commit -s -m "feat(ui): show live VRRP role on keepalived dashboard tile"
```

---

### Task 8: Embed UI into control-plane image

**Files:**
- `pihole-ha/platform/control-plane/app/static/next/` (built assets)
- `pihole-ha` embed build script (follow existing `build:pihole-cp-embed` workflow in repo)

- [ ] **Step 1: Build pi-fabric UI**

From `pi-fabric`:

```bash
npm --prefix apps/ui ci
npm run build:pihole-cp
```

- [ ] **Step 2: Copy/sync bundle into `pihole-ha` per existing README / `static/next/README.md`**

Follow the checked-in procedure in `platform/control-plane/app/static/next/README.md` (do not invent a new path).

- [ ] **Step 3: Rebuild control-plane on node**

```bash
pihole-ha-refresh   # or docker compose build control-plane && up -d
```

- [ ] **Step 4: Commit embedded assets in `pihole-ha` (if repo policy commits them)**

```bash
git add platform/control-plane/app/static/next/
git commit -s -m "chore(control-plane): embed UI with VRRP role display"
```

---

## Phase D — Governance (`dns-fabric`)

### Task 9: ADR-0054 + spec closure

**Files:**
- Create: `docs/adr/ADR-0054-pihole-ha-control-plane-vrrp-read-model.md`
- Modify: `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §8

- [ ] **Step 1: ADR (short MADR)**

Sections: Context, Decision (notify JSON + RO mount), Consequences, Alternatives rejected (D-Bus, parse `/run`), Rollout (upgrade order: scripts → compose → UI embed).

- [ ] **Step 2: Spec §8**

Mark “Keepalived / VRRP authoritative state” as **Implemented** with link to ADR-0054 and this plan.

- [ ] **Step 3: Commit (`pi-fabric`)**

```bash
git add docs/adr/ADR-0054-pihole-ha-control-plane-vrrp-read-model.md \
  docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md
git commit -s -m "docs: ADR-0054 control-plane VRRP read model"
```

---

## LAN hint “unknown” (related, optional Task 10)

The orange VRRP box is independent of **LAN hint: unknown**. To fix the hint, ensure `.env` **`PIHOLE_NODE1`** / **`PIHOLE_NODE2`** match each Pi’s real LAN IPv4 (see `vip_probe` local source address). Document in `control-plane-ui.md`; no code change required if values are already correct.

- [ ] **Step 1: Add one paragraph to `control-plane-ui.md` under keepalived**

Explain: `lan_identity_hint` compares probe source IP to `PIHOLE_NODE1`/`PIHOLE_NODE2`; mismatch → `unknown`.

---

## Rollout checklist (operator)

1. Merge **`pihole-ha`** Phase A–B; run **`pihole-ha-refresh`** on **pi1** and **pi2**.
2. Verify host file: `cat /opt/pihole-ha/data/keepalived/vrrp-state.json`.
3. Recreate **control-plane** (new volume mount).
4. `curl …/dashboard | jq .sections.keepalived.vrrp`.
5. Merge **`pi-fabric`** UI; rebuild embed; refresh again.
6. Failover test: `systemctl stop keepalived` on MASTER → role flips on both nodes’ dashboards after notify.

---

## Self-review (plan author)

| Spec requirement | Task |
|------------------|------|
| Host / VIP read-only adapter includes Keepalived summary | Tasks 4–5, 7 |
| No mutations / read-only | No mutation routes touched |
| Partial degradation when file missing | Adapter + UI amber path |
| Compose / mount documented | Tasks 5–6 |
| Tests | Tasks 4, 5, 7 |
| OpenAPI drift | Task 5 step 5 |

**Placeholder scan:** None.

**Type consistency:** `read_vrrp_state()` return shape matches UI `vrrp` object in Tasks 7–8.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-vrrp-dashboard.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — one subagent per task, review between tasks, fast iteration on **`pihole-ha`** then **`pi-fabric`**.

2. **Inline execution** — run phases A→D in this session with `executing-plans`, checkpoints after Phase B (API correct) and Phase C (UI).

Which approach do you want?
