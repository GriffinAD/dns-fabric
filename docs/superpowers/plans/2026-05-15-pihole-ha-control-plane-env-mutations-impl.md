# Pi-hole HA control plane — `.env` mutations implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship **ADR-0053** — allowlisted **Tier-1** `.env` read/write via HTTP (stage → apply → rollback), host `pihole-ha-apply-env-patch.sh`, and a **Settings** panel in the embedded Pi-hole CP UI.

**Architecture:** **`pihole-ha`** owns validation (`env_config.py`), staging file on a **rw** control-plane data mount, mutation routes sharing **`mutations.py`** auth/audit helpers, and a **bash + Python** host apply path that never exposes secrets to the container. **`pi-fabric`** adds Zod schemas, `PiholeCpGateway` methods, and `PiholeCpEnvSettings.svelte` bound to `/v1/config/env*`. Default deploy: **PATCH stages** + **POST apply** returns **202** until `CONTROL_PLANE_HOST_APPLY=1` and sudoers are installed.

**Tech Stack:** FastAPI, Python 3.11+, bash (`load-env-safe.sh`), Vitest/Svelte 5, `unittest` + `TestClient`, OpenAPI export in `pihole-ha`.

**Normative:** `docs/adr/ADR-0053-pihole-ha-control-plane-env-mutations.md` (**Accepted**).

---

## File map

| Path | Responsibility |
|------|----------------|
| `pihole-ha/platform/control-plane/app/env_config.py` | Tier-1 allowlist, validation, effective values from `os.environ` |
| `pihole-ha/platform/control-plane/app/env_pending.py` | Read/write `pending-env.json` on state dir |
| `pihole-ha/platform/control-plane/app/routes/config_env.py` | `GET/PATCH /v1/config/env`, `GET …/schema` |
| `pihole-ha/platform/control-plane/app/routes/mutations.py` | `POST …/env/apply`, `…/rollback`; deprecate `POST …/dnscrypt` |
| `pihole-ha/platform/control-plane/app/mutation_auth.py` | Extract `_require_auth`, `_audit` from mutations (DRY) |
| `pihole-ha/ops/lib/env_patch_merge.py` | Safe merge of allowlisted keys into `.env` lines |
| `pihole-ha/ops/runtime/control-plane/apply-env-patch.sh` | Backup, merge, render-config, minimal refresh, rollback |
| `pihole-ha/platform/core/docker-compose.control-plane.override.yml` | Rw mount `data/control-plane` → `/var/lib/control-plane` |
| `pihole-ha/tests/test_env_config.py` | Unit tests for validation |
| `pihole-ha/tests/test_control_plane.py` | API + audit integration (extend existing file) |
| `pi-fabric/apps/ui/src/lib/piholeCp/envConfigZod.ts` | Zod for env API |
| `pi-fabric/apps/ui/src/lib/piholeCp/PiholeCpGateway.ts` | `getEnvConfig`, `patchEnvConfig`, `applyEnv`, `rollbackEnv` |
| `pi-fabric/apps/ui/src/lib/piholeCp/PiholeCpEnvSettings.svelte` | Settings form (Tier-1 toggles) |
| `pi-fabric/apps/ui/src/lib/piholeCp/PiholeOperatorApp.svelte` | Mount settings when token configured |

---

### Task 1: Tier-1 validation module (`pihole-ha`)

**Files:**

- Create: `pihole-ha/platform/control-plane/app/env_config.py`
- Create: `pihole-ha/tests/test_env_config.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_env_config.py
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "platform" / "control-plane" / "app"
sys.path.insert(0, str(APP))

import env_config as ec  # noqa: E402


class TestEnvConfig(unittest.TestCase):
    def test_unknown_key_rejected(self) -> None:
        with self.assertRaises(ec.EnvConfigError) as ctx:
            ec.validate_changes({"PIHOLE_WEBPASSWORD": "x"})
        self.assertEqual(ctx.exception.code, "forbidden_key")

    def test_dnscrypt_enabled_accepts_01(self) -> None:
        ec.validate_changes({"DNSCRYPT_PROXY_ENABLED": "1"})

    def test_port_range(self) -> None:
        with self.assertRaises(ec.EnvConfigError):
            ec.validate_changes({"DNSCRYPT_PROXY_PORT": "80"})
        ec.validate_changes({"DNSCRYPT_PROXY_PORT": "5053"})

    def test_effective_from_environ(self) -> None:
        with unittest.mock.patch.dict(
            os.environ,
            {"DNSCRYPT_PROXY_ENABLED": "1", "CONTROL_PLANE_NODE_NAME": "pi2"},
            clear=False,
        ):
            eff = ec.effective_tier1()
        self.assertEqual(eff["DNSCRYPT_PROXY_ENABLED"], "1")
        self.assertEqual(eff["CONTROL_PLANE_NODE_NAME"], "pi2")
```

- [ ] **Step 2: Run tests (expect FAIL)**

```bash
cd /Volumes/Data/piHole/pihole-ha
python3 -m unittest tests.test_env_config -v
```

Expected: `ModuleNotFoundError: env_config`

- [ ] **Step 3: Implement `env_config.py`**

```python
"""ADR-0053 Tier-1 .env keys: validation and effective values."""

from __future__ import annotations

import os
import re
from typing import Any

TIER1_KEYS: frozenset[str] = frozenset(
    {
        "DNSCRYPT_PROXY_ENABLED",
        "DNSCRYPT_PROXY_PORT",
        "CONTROL_PLANE_UI_ENABLED",
        "CONTROL_PLANE_UI_HOST_PORT",
        "CONTROL_PLANE_NODE_NAME",
        "CONTROL_PLANE_PEER_UI_BASE_URL",
        "CONTROL_PLANE_KEA_FABRIC_API_BASE_URL",
    }
)

_NODE_NAME_RE = re.compile(r"^[a-zA-Z0-9._-]{1,32}$")
_URL_RE = re.compile(r"^https?://[^\s]+$", re.IGNORECASE)


class EnvConfigError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _as_str(v: Any) -> str:
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, str):
        return v.strip()
    raise EnvConfigError("invalid_type", f"unsupported value type: {type(v)!r}")


def validate_changes(changes: dict[str, Any]) -> dict[str, str]:
    if not changes:
        raise EnvConfigError("empty_changes", "changes must not be empty")
    out: dict[str, str] = {}
    for key, raw in changes.items():
        if key not in TIER1_KEYS:
            raise EnvConfigError("forbidden_key", f"key not allowlisted: {key}")
        val = _as_str(raw)
        if key in ("DNSCRYPT_PROXY_ENABLED", "CONTROL_PLANE_UI_ENABLED"):
            if val not in ("0", "1"):
                raise EnvConfigError("invalid_value", f"{key} must be 0 or 1")
        elif key in ("DNSCRYPT_PROXY_PORT", "CONTROL_PLANE_UI_HOST_PORT"):
            try:
                port = int(val)
            except ValueError as exc:
                raise EnvConfigError("invalid_value", f"{key} must be integer") from exc
            if port < 1024 or port > 65535:
                raise EnvConfigError("invalid_value", f"{key} out of range")
            val = str(port)
        elif key == "CONTROL_PLANE_NODE_NAME":
            if not _NODE_NAME_RE.match(val):
                raise EnvConfigError("invalid_value", f"{key} invalid")
        elif key in ("CONTROL_PLANE_PEER_UI_BASE_URL", "CONTROL_PLANE_KEA_FABRIC_API_BASE_URL"):
            if val and not _URL_RE.match(val):
                raise EnvConfigError("invalid_value", f"{key} must be empty or http(s) URL")
        out[key] = val
    return out


def effective_tier1() -> dict[str, str]:
    def g(name: str, default: str = "") -> str:
        return (os.environ.get(name, default) or default).strip()

    return {
        "DNSCRYPT_PROXY_ENABLED": "1" if g("DNSCRYPT_PROXY_ENABLED", "0") == "1" else "0",
        "DNSCRYPT_PROXY_PORT": g("DNSCRYPT_PROXY_PORT", "5053") or "5053",
        "CONTROL_PLANE_UI_ENABLED": "1" if g("CONTROL_PLANE_UI_ENABLED", "0") == "1" else "0",
        "CONTROL_PLANE_UI_HOST_PORT": g("CONTROL_PLANE_UI_HOST_PORT", "8091") or "8091",
        "CONTROL_PLANE_NODE_NAME": g("CONTROL_PLANE_NODE_NAME", "unknown") or "unknown",
        "CONTROL_PLANE_PEER_UI_BASE_URL": g("CONTROL_PLANE_PEER_UI_BASE_URL"),
        "CONTROL_PLANE_KEA_FABRIC_API_BASE_URL": g("CONTROL_PLANE_KEA_FABRIC_API_BASE_URL"),
    }


def schema_entries() -> list[dict[str, object]]:
    labels = {
        "DNSCRYPT_PROXY_ENABLED": "DNSCrypt proxy",
        "DNSCRYPT_PROXY_PORT": "DNSCrypt port",
        "CONTROL_PLANE_UI_ENABLED": "Control plane UI",
        "CONTROL_PLANE_UI_HOST_PORT": "Control plane port",
        "CONTROL_PLANE_NODE_NAME": "Node name",
        "CONTROL_PLANE_PEER_UI_BASE_URL": "Peer dashboard URL",
        "CONTROL_PLANE_KEA_FABRIC_API_BASE_URL": "Kea Fabric API URL",
    }
    types = {
        "DNSCRYPT_PROXY_ENABLED": "boolean",
        "DNSCRYPT_PROXY_PORT": "integer",
        "CONTROL_PLANE_UI_ENABLED": "boolean",
        "CONTROL_PLANE_UI_HOST_PORT": "integer",
        "CONTROL_PLANE_NODE_NAME": "string",
        "CONTROL_PLANE_PEER_UI_BASE_URL": "url",
        "CONTROL_PLANE_KEA_FABRIC_API_BASE_URL": "url",
    }
    return [
        {
            "key": k,
            "tier": 1,
            "type": types[k],
            "label": labels[k],
            "requires_apply": True,
        }
        for k in sorted(TIER1_KEYS)
    ]
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
python3 -m unittest tests.test_env_config -v
```

- [ ] **Step 5: Commit (`pihole-ha`)**

```bash
git add platform/control-plane/app/env_config.py tests/test_env_config.py
git commit -s -m "feat(control-plane): ADR-0053 Tier-1 env validation module"
```

---

### Task 2: Pending patch store + config routes (`pihole-ha`)

**Files:**

- Create: `pihole-ha/platform/control-plane/app/env_pending.py`
- Create: `pihole-ha/platform/control-plane/app/mutation_auth.py`
- Create: `pihole-ha/platform/control-plane/app/routes/config_env.py`
- Modify: `pihole-ha/platform/control-plane/app/main.py` (include router)
- Modify: `pihole-ha/platform/control-plane/app/routes/mutations.py` (use `mutation_auth`)

- [ ] **Step 1: `env_pending.py`**

```python
"""Stage PATCH /v1/config/env to pending-env.json (ADR-0053)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def state_dir() -> Path:
    raw = (os.environ.get("CONTROL_PLANE_ENV_STATE_DIR") or "/var/lib/control-plane").strip()
    return Path(raw)


def pending_path() -> Path:
    return state_dir() / "pending-env.json"


def read_pending() -> dict[str, str] | None:
    p = pending_path()
    if not p.is_file():
        return None
    data = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return None
    return {str(k): str(v) for k, v in data.items()}


def write_pending(changes: dict[str, str]) -> None:
    state_dir().mkdir(parents=True, exist_ok=True)
    pending_path().write_text(
        json.dumps(changes, separators=(",", ":"), sort_keys=True),
        encoding="utf-8",
    )


def clear_pending() -> None:
    p = pending_path()
    if p.is_file():
        p.unlink()
```

- [ ] **Step 2: `mutation_auth.py`** — move `_require_auth`, `_audit`, `_deny` from `mutations.py` unchanged signatures.

- [ ] **Step 3: `config_env.py` routes**

```python
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

from env_config import EnvConfigError, effective_tier1, schema_entries, validate_changes
from env_pending import clear_pending, read_pending, write_pending
from mutation_auth import audit, require_auth

router = APIRouter(tags=["config"])


@router.get("/config/env/schema")
def env_schema() -> dict[str, object]:
    return {"keys": schema_entries()}


@router.get("/config/env")
def env_get() -> dict[str, object]:
    return {"effective": effective_tier1(), "pending": read_pending()}


@router.patch("/config/env")
def env_patch(
    body: dict[str, object],
    request: Request,
    x_api_token: str | None = Header(default=None, alias="X-Api-Token"),
) -> JSONResponse:
    route = "config.env.patch"
    require_auth(route, request, x_api_token)
    raw = body.get("changes")
    if not isinstance(raw, dict):
        audit(route, "failed", error_code="invalid_body")
        return JSONResponse(status_code=422, content={"error": "invalid_body"})
    try:
        changes = validate_changes(raw)
    except EnvConfigError as exc:
        audit(route, "failed", error_code=exc.code, changes=raw)
        return JSONResponse(status_code=422, content={"error": exc.code, "message": exc.message})
    write_pending(changes)
    audit(route, "accepted_staged", changes=changes)
    return JSONResponse(status_code=202, content={"staged": changes, "pending": read_pending()})
```

- [ ] **Step 4: Wire router in `main.py`**

```python
from routes.config_env import router as config_env_router

app.include_router(config_env_router, prefix="/v1")
```

- [ ] **Step 5: API tests** (add to `tests/test_control_plane.py`)

```python
class TestConfigEnvApi(unittest.TestCase):
    def test_patch_requires_token(self) -> None:
        from fastapi.testclient import TestClient

        with patch.dict(os.environ, {"CONTROL_PLANE_API_TOKEN": "secret"}, clear=False):
            client = TestClient(main_mod.app)
            r = client.patch("/v1/config/env", json={"changes": {"DNSCRYPT_PROXY_ENABLED": "1"}})
        self.assertEqual(r.status_code, 403)

    def test_patch_stages_valid_key(self) -> None:
        from fastapi.testclient import TestClient

        with tempfile.TemporaryDirectory() as tmp:
            state = str(Path(tmp) / "state")
            with patch.dict(
                os.environ,
                {
                    "CONTROL_PLANE_API_TOKEN": "secret",
                    "CONTROL_PLANE_ENV_STATE_DIR": state,
                },
                clear=False,
            ):
                client = TestClient(main_mod.app)
                r = client.patch(
                    "/v1/config/env",
                    json={"changes": {"DNSCRYPT_PROXY_ENABLED": "1"}},
                    headers={"X-Api-Token": "secret"},
                )
            self.assertEqual(r.status_code, 202)
            self.assertEqual(r.json()["staged"]["DNSCRYPT_PROXY_ENABLED"], "1")
```

- [ ] **Step 6: Run tests**

```bash
python3 -m venv .venv-t && .venv-t/bin/pip install -q docker==7.1.0 fastapi==0.115.6 httpx==0.28.1
.venv-t/bin/python -m unittest tests.test_env_config tests.test_control_plane.TestConfigEnvApi -v
```

- [ ] **Step 7: Commit**

```bash
git add platform/control-plane/app/env_pending.py platform/control-plane/app/mutation_auth.py \
  platform/control-plane/app/routes/config_env.py platform/control-plane/app/main.py \
  platform/control-plane/app/routes/mutations.py tests/test_control_plane.py
git commit -s -m "feat(control-plane): stage Tier-1 env PATCH per ADR-0053"
```

---

### Task 3: Host `.env` merge helper (`pihole-ha`)

**Files:**

- Create: `pihole-ha/ops/lib/env_patch_merge.py`
- Create: `pihole-ha/tests/test_env_patch_merge.py`

- [ ] **Step 1: Failing test**

```python
def test_merge_replaces_existing_key(tmp_path: Path) -> None:
    env = tmp_path / ".env"
    env.write_text("DNSCRYPT_PROXY_ENABLED=0\nFOO=bar\n", encoding="utf-8")
    merge_env_file(env, {"DNSCRYPT_PROXY_ENABLED": "1"}, allowlist={"DNSCRYPT_PROXY_ENABLED", "FOO"})
    text = env.read_text(encoding="utf-8")
    assert "DNSCRYPT_PROXY_ENABLED=1" in text
    assert "FOO=bar" in text
    assert "DNSCRYPT_PROXY_ENABLED=0" not in text
```

- [ ] **Step 2: Implement `merge_env_file`**

```python
def merge_env_file(
    path: Path,
    changes: dict[str, str],
    *,
    allowlist: set[str],
) -> None:
    for k in changes:
        if k not in allowlist:
            raise ValueError(f"forbidden key: {k}")
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        core = line.rstrip("\r\n")
        if "=" in core and not core.lstrip().startswith("#"):
            key = core.split("=", 1)[0].strip()
            if key in changes:
                out.append(f"{key}={changes[key]}\n")
                seen.add(key)
                continue
        out.append(line if line.endswith("\n") else line + "\n")
    for key, val in sorted(changes.items()):
        if key not in seen:
            out.append(f"{key}={val}\n")
    path.write_text("".join(out), encoding="utf-8")
```

- [ ] **Step 3: Run `python3 -m unittest tests.test_env_patch_merge -v`**

- [ ] **Step 4: Commit**

---

### Task 4: `apply-env-patch.sh` + install symlink (`pihole-ha`)

**Files:**

- Create: `pihole-ha/ops/runtime/control-plane/apply-env-patch.sh`
- Modify: `pihole-ha/ops/install/preflight.sh` (touch `data/control-plane`, `data/logs/control-plane-audit.jsonl`)

- [ ] **Step 1: Script skeleton**

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${PIHOLE_HA_BASE:-/opt/pihole-ha}"
# shellcheck source=../../lib/load-env-safe.sh
source "$BASE/ops/lib/load-env-safe.sh"
PATCH_FILE=""
NODE=""
ROLLBACK=0
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --node) NODE="$2"; shift 2 ;;
    --patch-file) PATCH_FILE="$2"; shift 2 ;;
    --rollback) ROLLBACK=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$NODE" ]] || { echo "ERROR: --node pi1|pi2 required" >&2; exit 2; }
ENV_FILE="$BASE/.env"
# rollback: pick newest .env.bak.*
if [[ "$ROLLBACK" -eq 1 ]]; then
  latest="$(ls -1t "$BASE"/.env.bak.* 2>/dev/null | head -1 || true)"
  [[ -n "$latest" ]] || { echo "ERROR: no .env.bak.* found" >&2; exit 1; }
  cp "$latest" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  [[ -f "$PATCH_FILE" ]] || { echo "ERROR: missing --patch-file" >&2; exit 2; }
  ts="$(date +%s)"
  cp "$ENV_FILE" "$ENV_FILE.bak.$ts"
  chmod 600 "$ENV_FILE.bak.$ts"
  python3 "$BASE/ops/lib/env_patch_merge.py" "$ENV_FILE" "$PATCH_FILE"
fi
bash "$BASE/ops/install/render-config.sh" --node "$NODE"
# prune backups >5
ls -1t "$BASE"/.env.bak.* 2>/dev/null | tail -n +6 | xargs -r rm -f
# minimal refresh (no pull): reuse compose-core up — same as dhcp-none inner path
load_env_safe "$ENV_FILE"
# shellcheck source=../../lib/compose-core.sh
source "$BASE/ops/lib/compose-core.sh"
pihole_ha_docker_compose_up_core_stack "$ENV_FILE"
```

Add `env_patch_merge.py` CLI:

```python
if __name__ == "__main__":
    import sys
    merge_env_file(Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text()), allowlist=...)
```

- [ ] **Step 2: Install to `/usr/local/bin`** — document in `docs/operations/control-plane-env-mutations.md` (copy from `ops/install` pattern used by refresh scripts).

- [ ] **Step 3: Manual smoke on lab node**

```bash
sudo /usr/local/bin/pihole-ha-apply-env-patch.sh --node pi2 --patch-file /tmp/patch.json --dry-run
```

- [ ] **Step 4: Commit**

---

### Task 5: Apply / rollback HTTP + compose mount (`pihole-ha`)

**Files:**

- Modify: `pihole-ha/platform/control-plane/app/routes/mutations.py`
- Modify: `pihole-ha/platform/core/docker-compose.control-plane.override.yml`

- [ ] **Step 1: Compose rw state volume**

```yaml
      CONTROL_PLANE_ENV_STATE_DIR: /var/lib/control-plane
    volumes:
      - ${PIHOLE_HA_BASE:-/opt/pihole-ha}/data/control-plane:/var/lib/control-plane
```

Preflight: `mkdir -p "${PIHOLE_HA_BASE}/data/control-plane"` and `chmod 700`.

- [ ] **Step 2: `POST /v1/mutations/env/apply`**

```python
@router.post("/mutations/env/apply")
def env_apply(request: Request, x_api_token: str | None = Header(...)) -> JSONResponse:
    route = "mutations.env.apply"
    require_auth(route, request, x_api_token)
    pending = read_pending()
    if not pending:
        audit(route, "failed", error_code="no_pending_patch")
        raise HTTPException(status_code=409, detail="No pending env patch.")
    if os.environ.get("CONTROL_PLANE_HOST_APPLY", "").strip() != "1":
        audit(route, "accepted_deferred", changes=pending)
        return JSONResponse(status_code=202, content=_host_action_envelope(route, pending))
    # write pending to /var/lib/control-plane/apply-patch.json; subprocess apply script
    ...
```

When host apply succeeds: `clear_pending()`, audit `applied` + `backup_path`.

- [ ] **Step 3: `POST /v1/mutations/env/rollback`** — same host deferral pattern; script `--rollback`.

- [ ] **Step 4: Deprecate `POST /v1/mutations/dnscrypt`** → **410** body points to `PATCH /v1/config/env` + apply.

- [ ] **Step 5: Extend `TestMutationsApi`** — apply without pending → **409**; patch secret key → **422**.

- [ ] **Step 6: Regenerate OpenAPI** (if export script exists): `uv run python scripts/export_openapi.py` or project-local equivalent under `pihole-ha`.

- [ ] **Step 7: Commit**

---

### Task 6: Pi-hole CP UI — gateway + settings panel (`pi-fabric`)

**Files:**

- Create: `apps/ui/src/lib/piholeCp/envConfigZod.ts`
- Create: `apps/ui/src/lib/piholeCp/PiholeCpEnvSettings.svelte`
- Create: `apps/ui/src/lib/piholeCp/PiholeCpEnvSettings.svelte.test.ts`
- Modify: `apps/ui/src/lib/piholeCp/PiholeCpGateway.ts`
- Modify: `apps/ui/src/lib/piholeCp/PiholeOperatorApp.svelte`

- [ ] **Step 1: Zod schemas**

```typescript
import { z } from "zod";

export const envSchemaEntrySchema = z.object({
  key: z.string(),
  tier: z.number(),
  type: z.enum(["boolean", "integer", "string", "url"]),
  label: z.string(),
  requires_apply: z.boolean(),
});

export const envConfigResponseSchema = z.object({
  effective: z.record(z.string(), z.string()),
  pending: z.record(z.string(), z.string()).nullable(),
});
```

- [ ] **Step 2: Gateway methods with token header**

```typescript
async patchEnvConfig(
  changes: Record<string, string>,
  apiToken: string,
): Promise<{ staged: Record<string, string> }> {
  const res = await fetch(this.url("/v1/config/env"), {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Api-Token": apiToken,
    },
    body: JSON.stringify({ changes }),
  });
  ...
}
```

- [ ] **Step 3: `PiholeCpEnvSettings.svelte`**

- Load `GET /v1/config/env/schema` + `GET /v1/config/env` on mount.
- Render toggles for boolean keys, number inputs for ports, text for URLs.
- **Save** → `patchEnvConfig` then **Apply** → `applyEnv` (show 202 message with script names if deferred).
- **Rollback** button → `rollbackEnv`.
- Store API token from `import.meta.env.VITE_PIHOLE_CP_API_TOKEN` or prompt once in sessionStorage key `pihole-cp-api-token` (never persist to layout storage).

- [ ] **Step 4: Mount in operator chrome** — collapsible “Settings” section under node banner in `PiholeOperatorApp.svelte`.

- [ ] **Step 5: Vitest** — mock `fetch`; patch stages; apply 202 shows host script hint.

- [ ] **Step 6: Run UI gate**

```bash
cd /Volumes/Data/piHole/pi-fabric
npm run check:ui-unit
```

Expected: **PASS**, 100% on touched `src/lib/piholeCp/**` paths.

- [ ] **Step 7: Commit (`pi-fabric`)**

```bash
git commit -s -m "feat(ui): Pi-hole CP env settings panel per ADR-0053"
```

---

### Task 7: Embed build + ops docs (`both repos`)

**Files:**

- Modify: `pi-fabric/docs/operations/control-plane-ui.md` — `VITE_PIHOLE_CP_API_TOKEN`, settings panel
- Modify: `pihole-ha/docs/operations/control-plane-ui.md` — `CONTROL_PLANE_HOST_APPLY`, sudoers example
- Modify: `pihole-ha/docs/operations/control-plane-env-mutations.md` — remove “not deployed” note after ship

- [ ] **Step 1: Sudoers example (document only)**

```text
# /etc/sudoers.d/pihole-ha-control-plane
control-plane ALL=(root) NOPASSWD: /usr/local/bin/pihole-ha-apply-env-patch.sh
```

- [ ] **Step 2: Build embed**

```bash
cd /Volumes/Data/piHole/pi-fabric/apps/ui && npm run build
# sync dist into pihole-ha platform/control-plane static per existing playbook
```

- [ ] **Step 3: `bash scripts/check_markdownlint.sh`** on dns-fabric docs touched.

- [ ] **Step 4: Commit docs in both repos**

---

### Task 8: Acceptance smoke (manual)

- [ ] **Step 1:** Set `CONTROL_PLANE_API_TOKEN` in `.env`, rebuild control-plane.
- [ ] **Step 2:** PATCH `DNSCRYPT_PROXY_ENABLED=1`, apply (host script or 202 path).
- [ ] **Step 3:** Confirm `sections.dnscrypt.env_enabled` and container row in UI.
- [ ] **Step 4:** Rollback; confirm prior value restored.

---

## Self-review

| ADR-0053 requirement | Task |
|----------------------|------|
| Tier-1 allowlist (7 keys) | Task 1 |
| GET schema / GET env / PATCH stage | Task 2 |
| POST apply / rollback | Task 5 |
| Host script + backup `.env.bak.*` | Tasks 3–4 |
| Audit JSONL fields | Tasks 2, 5 (`mutation_auth`) |
| No Pi-hole file writes | All tasks (env only) |
| UI settings | Task 6 |
| `POST /mutations/dnscrypt` deprecated | Task 5 |

| Placeholder scan | OK |
|------------------|-----|
| TBD / implement later | None |
| “Similar to Task N” | None |

---

**Plan complete and saved to** `docs/superpowers/plans/2026-05-15-pihole-ha-control-plane-env-mutations-impl.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — Task 1 → review → Task 2 …
2. **Inline execution** — implement in this session with checkpoints after Tasks 2 and 5.

**Which approach?**
