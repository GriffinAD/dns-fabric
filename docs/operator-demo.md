# Operator UI demo (local)

Scripted path to run the Kea Fabric API (mock Kea/Nebula adapters, durable layout
on disk) and the Vite operator shell. Suitable for walkthroughs and manual dashboard
editor checks.

## Prerequisites

- [`uv`](https://docs.astral.sh/uv/) on your `PATH`
- Node 22+ and npm (for `apps/ui`)

## One-time per clone

- Enable versioned Git hooks (DCO / commit message hygiene):

  ```bash
  git config core.hooksPath .githooks
  ```

- Install UI dependencies:

  ```bash
  npm --prefix apps/ui install
  ```

## Run

**Terminal A — API** (mock DHCP/discovery/perf + Nebula summary; data under `KEA_FABRIC_DATA_DIR`):

```bash
bash scripts/dev_serve_with_examples.sh
# equivalent: uv run kea-fabric-api
```

Listens on `http://127.0.0.1:8080` (`/api/v1/*`).

**Terminal B — operator shell** against the **real** API (skips in-process mocks; proxies `/api` to 8080):

```bash
npm --prefix apps/ui run dev:proxy
```

For **mock-only** UI (CI / default dev, no backend):

```bash
npm --prefix apps/ui run dev
```

Open the URL Vite prints (default `http://localhost:5173`). Use the nav links:

- **Overview** — runtime phase
- **Plugins** — discovered packages and `ui_dashboard` columns
- **Dashboard** — drag layout hosts or dashboard-capable plugins onto the drop zone;
  use **Refresh runtime** if you change manifests on disk

### Optional API auth (lab)

If you set `KEA_FABRIC_API_TOKEN` before starting the API, add a **public** dev token
to the UI (never commit real secrets):

```bash
# apps/ui/.env.local
VITE_API_AUTH_TOKEN=same-value-as-KEA_FABRIC_API_TOKEN
```

`DataGateway` sends `Authorization: Bearer …` on fetch and `access_token=…` on SSE
(`EventSource` cannot set headers). The SSE query token path is for local/lab use and
is scheduled for hardening in the platform security phases.

## Playwright (`npm run check:ui-e2e`)

By default Playwright starts Vite on `127.0.0.1:5173` with `VITE_E2E_THROWING=1` so the plugin-isolation spec can register the throwing tile. Free that port before running e2e, or set **`PW_REUSE_DEV_SERVER=1`** only if you already have a dev server on that URL **and** it was started with `VITE_E2E_THROWING=1`.

## Stop

Interrupt both terminals (`Ctrl+C`). Layout files remain under **`KEA_FABRIC_DATA_DIR`**
(default `.fabric-data` in the current working directory when you started the API).
