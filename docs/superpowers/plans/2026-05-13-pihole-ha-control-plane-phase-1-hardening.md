# Pi-hole HA control plane — Phase 1 hardening (spec §7 Phase 1 closure)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining **Phase 1** gaps from the normative design (`docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §6.2–§6.3, §8) without adding write surfaces: **contracted OpenAPI**, **documented error + SSE policy**, **stronger catalogue security tests**, **repeatable smoke**.

**Architecture:** Runtime stays in **`pihole-ha`** (`platform/control-plane/`). Contract artefacts live beside the image source; **dns-fabric** only receives doc/ADR pointers if you choose to mirror policy there.

**Tech stack:** Python 3.12, FastAPI, `unittest`, GitHub Actions `validate.yml`, optional `shellcheck` for new shell wrappers.

**Normative spec:** `docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §6–§8.

## Relationship to `2026-05-13-pihole-ha-control-plane-ui.md` (bootstrap plan)

The **bootstrap plan** in this repo already records **Phase 1 runtime** as **done**:

| Bootstrap | Status on `pihole-ha` `main` | What it delivered (do **not** re-implement in this hardening plan) |
|-----------|------------------------------|----------------------------------------------------------------------|
| **Task 2** | `[x]` | Optional compose service, `CORE_COMPOSE_FILES`, `pihole_ha_docker_compose_up_core_stack`, preflight file/port gates, initial operator doc. |
| **Task 3** | `[x]` | `adapters/docker_state.py`, `logs/catalog.py`, Docker SSE, `docker.sock`, `tests/test_control_plane.py` baseline, CI `mkdir` for compose validate, `pip` test deps. |
| **Task 4** | `[x]` | `sections.*` for `ha`, `pihole_dns`, `stack`, `keepalived` (initial), `dashboard.html`, compose env + mounts. |
| **Task 5** | `[x]` | Parallel `build_dashboard`, `widgets`, `pihole_runtime`, `kea_dhcp`, `schedules`, `dnscrypt`, VIP probe, `/v1/meta`, mutation **stubs**, file SSE, Kea + maintenance binds, version **0.4.0**. |

**This hardening plan** = **delta only**: design **§6.3 contract** (checked-in OpenAPI + drift CI), **§8** policy written down for operators, **extra catalogue security tests**, and a **dedicated smoke** doc. It **extends** Tasks 2–5; it does **not** replace or reopen them.

**Task 1** in the bootstrap file (procedural checkboxes for the original docs landing) is **orthogonal**; you may still tick those for housekeeping or leave them as historical.

---

## File map (this phase)

| Path (repo: `pihole-ha`) | Responsibility |
|--------------------------|----------------|
| `platform/control-plane/scripts/export_openapi.py` | Writes canonical **`openapi.json`** from `app.main:app` |
| `platform/control-plane/spec/openapi.json` | Checked-in contract (or `specs/` if you prefer one tree) |
| `.github/workflows/validate.yml` | Fails CI if exported OpenAPI drifts from committed file |
| `tests/test_control_plane.py` | Extra assertions: catalogue id allowlist, no path injection |
| `docs/operations/control-plane-ui.md` | Documents HTTP **200 + per-section `ok`** (not 207) and SSE “tail from now” |
| `docs/operations/control-plane-smoke.md` | New: copy-paste smoke for pi1/pi2 |

---

### Task 1: OpenAPI export script (canonical JSON)

**Files:**

- Create: `platform/control-plane/scripts/export_openapi.py`
- Create: `platform/control-plane/spec/` (directory)
- Modify: `.github/workflows/validate.yml` (add drift check step after unit tests)

- [ ] **Step 1: Add export script**

Create `platform/control-plane/scripts/export_openapi.py` with exactly:

```python
"""Emit FastAPI OpenAPI JSON for the control plane (CI + drift check)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "app"
sys.path.insert(0, str(ROOT))

from main import app  # noqa: E402


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "spec" / "openapi.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = app.openapi()
    out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Generate the first `openapi.json`**

Run (from **`pihole-ha`** repo root, with the same deps as CI tests):

```bash
cd /path/to/pihole-ha
python3 -m venv .venv-openapi && .venv-openapi/bin/pip install -q docker==7.1.0 fastapi==0.115.6 httpx==0.28.1
PYTHONPATH=platform/control-plane/app .venv-openapi/bin/python platform/control-plane/scripts/export_openapi.py
```

Expected stdout: ends with `platform/control-plane/spec/openapi.json` (path printed by script).

- [ ] **Step 3: Add CI drift check**

In `.github/workflows/validate.yml`, after the line that runs `python3 -m unittest discover`, append:

```yaml
      - name: Control plane OpenAPI drift check
        if: matrix.name == 'dhcp-none' && matrix.expect == 'pass'
        run: |
          set -euo pipefail
          python3 -m venv .venv-openapi
          .venv-openapi/bin/pip install -q docker==7.1.0 fastapi==0.115.6 httpx==0.28.1
          cp platform/control-plane/spec/openapi.json /tmp/openapi.before.json
          PYTHONPATH=platform/control-plane/app .venv-openapi/bin/python platform/control-plane/scripts/export_openapi.py
          cmp -s platform/control-plane/spec/openapi.json /tmp/openapi.before.json
```

Expected: **`cmp`** exits **0** (no diff). If routes change, re-run Step 2 locally and commit the updated JSON.

- [ ] **Step 4: Commit (`pihole-ha`)**

```bash
git add platform/control-plane/scripts/export_openapi.py platform/control-plane/spec/openapi.json .github/workflows/validate.yml
git commit -s -m "feat(control-plane): add OpenAPI export and CI drift check"
```

---

### Task 2: Document error envelope + SSE policy (design §8)

**Files:**

- Modify: `docs/operations/control-plane-ui.md`

- [ ] **Step 1: Append “Contracts” section**

Add a subsection **Contracts** stating explicitly:

1. **`GET /dashboard`** returns HTTP **200**; failures are per **`sections.*.ok`** / **`error`** (we do **not** use HTTP **207** in Phase 1).
2. **`GET /logs/stream/{id}`** follows **tail-from-connect** semantics: the server does **not** honour **`Last-Event-ID`** replay in Phase 1; clients reconnect for live tail only.

- [ ] **Step 2: Commit**

```bash
git add docs/operations/control-plane-ui.md
git commit -s -m "docs(control-plane): document error envelope and SSE tail policy"
```

---

### Task 3: Catalogue security tests (design §6.3)

**Files:**

- Modify: `tests/test_control_plane.py`

- [ ] **Step 1: Add tests for rejected ids**

Add to `tests/test_control_plane.py` (reuse existing `APP` / `sys.path.insert` at top of file):

```python
class TestLogCatalogSecurity(unittest.TestCase):
    def test_resolve_rejects_path_traversal_ids(self) -> None:
        self.assertIsNone(catalog.resolve_log_stream("docker_../pihole"))
        self.assertIsNone(catalog.resolve_log_stream("file_pihole_maintenance\x00"))

    def test_catalog_ids_are_fixed_set(self) -> None:
        with patch.dict(os.environ, {}, clear=False):
            ids = {e["id"] for e in catalog.catalog_entries()}
        for lid in ids:
            self.assertRegex(lid, r"^[a-z0-9_]+$")
```

`patch` and `os` are already imported in `tests/test_control_plane.py` as of Phase 1 completion; if not, add `from unittest.mock import patch` and `import os`.

- [ ] **Step 2: Run tests**

```bash
cd /path/to/pihole-ha
python3 -m venv .venv-t && .venv-t/bin/pip install -q docker==7.1.0 fastapi==0.115.6 httpx==0.28.1
.venv-t/bin/python -m unittest discover -s tests -v
```

Expected: all tests **PASS** (including new class).

- [ ] **Step 3: Commit**

```bash
git add tests/test_control_plane.py
git commit -s -m "test(control-plane): harden log catalogue id allowlist"
```

---

### Task 4: Operator smoke doc (design §6.3 integration)

**Files:**

- Create: `docs/operations/control-plane-smoke.md`

- [ ] **Step 1: Create smoke doc**

Minimum contents: curls for **`/health`**, **`/v1/meta`**, **`/dashboard`**, **`/logs/catalog`**, one **`docker_`** SSE, and note that **`file_pihole_maintenance`** appears only when **`CONTROL_PLANE_MAINTENANCE_LOG`** is set in the container env (compose default documents this).

- [ ] **Step 2: Link from `docs/operations/control-plane-ui.md`**

Add one line under **Related** pointing to **`control-plane-smoke.md`**.

- [ ] **Step 3: Commit**

```bash
git add docs/operations/control-plane-smoke.md docs/operations/control-plane-ui.md
git commit -s -m "docs(control-plane): add operator smoke checklist"
```

---

## Self-review (spec coverage)

| Spec § | Covered by |
|--------|----------------|
| §6.2 partial results / no whole-page 500 for probes | Already implemented; Task 2 documents **200 + sections** choice (§8). |
| §6.3 unit + contract + log security | Tasks 1 + 3 (+ existing tests). |
| §8 SSE policy | Task 2 explicit “no Last-Event-ID”. |
| §8 error envelope | Task 2 explicit “not 207”. |

---

**Plan complete and saved to** `docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-phase-1-hardening.md`.

**Execution options:**

1. **Subagent-driven (recommended)** — one subagent per Task, review between tasks.
2. **Inline execution** — run Tasks 1–4 in order in one session with checkpoints after each commit.

Which approach do you want for implementation?
