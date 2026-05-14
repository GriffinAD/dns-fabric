# Pi-hole HA control plane — Phase 3 mutations with auth + audit (spec §7 Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Execution status (2026-05-14):** **ADR-0052** is **`Accepted`** (**Option A** — no HTTP DNSCrypt toggle). **`pihole-ha`** ships **`audit_log.py`**, **`routes/mutations.py`** (**403** / **202**), compose audit bind, **`docs/operations/control-plane-mutations.md`**, and **`tests/test_control_plane.py`** mutation + audit coverage. **ADR-0051** (**Option A**, no Pi-hole/DNS config writes over HTTP) is reflected in the same mutations doc. Further work is policy revisions only unless ADRs change.

**Goal:** Deliver design **Phase 3**: **DNSCrypt / refresh-script class mutations with authentication + audit** (`docs/superpowers/specs/2026-05-13-pihole-ha-control-plane-ui-design.md` §7). Replace **501** “not implemented” with **real, auditable operator actions** that still respect **GitOps + host scripts** as the ultimate source of truth unless ADR explicitly expands scope.

**Architecture:** **Bearer / `X-Api-Token`** (already partially used) + **append-only audit file** on a host bind mount + **idempotent** mutations that either (a) call **`docker exec`** on allowlisted containers, or (b) return **202** with a **machine-readable** reminder to run a **named host script** (choose one strategy per ADR-0052 — this plan ships **(a) + (b) documented** so operators can pick).

**Tech stack:** FastAPI, Python `json` lines audit, `unittest` + `TestClient`, compose volume for audit log.

**Normative spec:** Design §7 Phase 3; §6.1 mutations; §6.2 **403** without leaking internals.

## Relationship to `2026-05-13-pihole-ha-control-plane-ui.md` (bootstrap plan)

**Task 5** in that file shipped mutation **stubs** (`403` / `501`) on **`pihole-ha`** **`main`**. **Phase 3** **replaces or extends** those routes **only** per **ADR-0052**; it assumes the **read path** from Tasks **2–5** remains intact.

---

## File map (this phase)

| Path (`pihole-ha`) | Responsibility |
|--------------------|----------------|
| `docs/adr/` (in **dns-fabric**) | `ADR-0052` — auth + audit policy (**Accepted** before shipping behaviour change) |
| `platform/control-plane/app/audit_log.py` | Append-only JSONL audit writer |
| `platform/control-plane/app/routes/mutations.py` | Real status codes per ADR |
| `platform/core/docker-compose.control-plane.override.yml` | Bind mount for **`CONTROL_PLANE_AUDIT_LOG`** host path |
| `docs/operations/control-plane-mutations.md` | Operator-facing behaviour matrix |
| `tests/test_control_plane.py` | Audit line tests (use `tmp_path` mount pattern) |

---

### Task 1: ADR-0052 — authentication + audit policy (`dns-fabric`)

**Files:**

- Create: `docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md`

- [ ] **Step 1: Create ADR with concrete policy**

Use MADR template from `docs/_templates/ADR_TEMPLATE.md`. Minimum **Decision outcome** text to paste:

- **Authentication:** reuse **`CONTROL_PLANE_API_TOKEN`**; reject missing/invalid with **403** and **no echo** of secrets.
- **Audit:** every mutation attempt appends one JSON line to **`CONTROL_PLANE_AUDIT_LOG`** inside the container at a path backed by a **host file** mount (append-only from app perspective).
- **Authorisation:** mutations are **allowlisted** by route name; no generic command channel.
- **DNSCrypt toggle:** either **“not via HTTP”** (document host `.env` + refresh) **or** “HTTP triggers **only** `docker compose …` equivalent documented in ADR” — pick **one** in the ADR body.

- [ ] **Step 2: Commit (`dns-fabric`)**

```bash
git add docs/adr/ADR-0052-pihole-ha-control-plane-phase3-mutations-auth-audit.md
git commit -s -m "docs(adr): ADR-0052 Phase 3 control plane auth and audit"
git push dns-fabric main
```

---

### Task 2: Audit log module (`pihole-ha`)

**Files:**

- Create: `platform/control-plane/app/audit_log.py`

- [ ] **Step 1: Add `audit_log.py`**

```python
"""Append-only JSONL audit sink for control plane mutations."""

from __future__ import annotations

import json
import os
import time
from typing import Any


def audit_path() -> str | None:
    p = (os.environ.get("CONTROL_PLANE_AUDIT_LOG") or "").strip()
    return p or None


def append_audit(event: dict[str, Any]) -> None:
    path = audit_path()
    if not path:
        return
    line = dict(event)
    line.setdefault("ts_unix", time.time())
    payload = json.dumps(line, separators=(",", ":"), sort_keys=True) + "\n"
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(payload)
```

- [ ] **Step 2: Unit test (tmp file)**

Add to `tests/test_control_plane.py` (same `APP` `sys.path` setup as existing tests):

```python
class TestAuditLog(unittest.TestCase):
    def test_append_writes_jsonl(self) -> None:
        import tempfile
        from pathlib import Path

        import audit_log as al

        with tempfile.TemporaryDirectory() as tmp:
            p = str(Path(tmp) / "audit.log")
            with patch.dict(os.environ, {"CONTROL_PLANE_AUDIT_LOG": p}):
                al.append_audit({"action": "test", "ok": True})
            text = Path(p).read_text(encoding="utf-8")
        self.assertIn('"action":"test"', text.replace(" ", ""))
```

- [ ] **Step 3: Run tests**

```bash
python3 -m venv .venv-t && .venv-t/bin/pip install -q docker==7.1.0 fastapi==0.115.6 httpx==0.28.1
.venv-t/bin/python -m unittest discover -s tests -v
```

Expected: **PASS**.

- [ ] **Step 4: Commit**

```bash
git add platform/control-plane/app/audit_log.py tests/test_control_plane.py
git commit -s -m "feat(control-plane): append-only mutation audit log"
```

---

### Task 3: Wire mutations to audit + replace 501 with ADR behaviour

**Precondition:** ADR-0052 **Accepted**.

**Files:**

- Modify: `platform/control-plane/app/routes/mutations.py`
- Modify: `platform/control-plane/app/audit_log.py` (only if helpers needed)
- Modify: `docs/operations/control-plane-mutations.md`

- [ ] **Step 1: Instrument `mutations.py`**

On every `POST` handler entry:

```python
from audit_log import append_audit

append_audit({"route": "mutations.dnscrypt", "node": os.environ.get("CONTROL_PLANE_NODE_NAME"), "phase": "entry"})
```

Before raising **403** / returning success, append **`result`** field (`"denied"`, `"ok"`, `"not_implemented"`).

- [ ] **Step 2: Implement the first real mutation only as ADR allows**

Example pattern (replace body with ADR-permitted action):

```python
@router.post("/mutations/dnscrypt/reload")
def dnscrypt_reload(...):
    ...
    append_audit({..., "result": "attempt"})
    # ADR may require: docker exec send HUP — implement exactly as ADR lists
```

- [ ] **Step 3: Extend compose for audit file**

Add to `docker-compose.control-plane.override.yml`:

```yaml
      CONTROL_PLANE_AUDIT_LOG: ${CONTROL_PLANE_AUDIT_LOG:-/var/lib/control-plane/audit.jsonl}
```

And volume (host file, **read-write** so append works):

```yaml
      - ${PIHOLE_HA_BASE:-/opt/pihole-ha}/data/logs/control-plane-audit.jsonl:/var/lib/control-plane/audit.jsonl
```

- [ ] **Step 4: Preflight `touch`** the host audit file (same pattern as `pihole-maintenance.log`).

- [ ] **Step 5: Tests + OpenAPI regen + commit**

```bash
git add platform/control-plane/app/routes/mutations.py platform/core/docker-compose.control-plane.override.yml ops/install/preflight.sh docs/operations/control-plane-mutations.md tests/test_control_plane.py platform/control-plane/spec/openapi.json
git commit -s -m "feat(control-plane): Phase 3 auditable mutations per ADR-0052"
```

If **`platform/control-plane/spec/openapi.json`** does not exist yet, complete **`2026-05-13-pihole-ha-control-plane-phase-1-hardening.md`** first, or omit **`openapi.json`** from **`git add`** until export exists.

---

## Self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| Auth for mutations | ADR-0052 + existing token headers |
| Audit | Task 2–3 |
| DNSCrypt / refresh class | ADR must name exact endpoints; plan wires audit first |

---

**Plan complete and saved to** `docs/superpowers/plans/2026-05-13-pihole-ha-control-plane-phase-3-mutations-audit.md`.

**Execution options:**

1. **Subagent-driven (recommended)**
2. **Inline execution**

Which approach?
