# Operator UI demo (local)

Scripted path to run the Kea Fabric API with example plugins and the Vite operator
shell. Suitable for walkthroughs and manual dashboard editor checks.

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

**Terminal A — API** (example plugins + writable data dir):

```bash
bash scripts/dev_serve_with_examples.sh
```

Listens on `http://127.0.0.1:8080` (`GET /api/v1/*`).

**Terminal B — operator shell** (proxies `/api` to 8080 per `apps/ui/vite.config.ts`):

```bash
npm --prefix apps/ui run dev
```

Open the URL Vite prints (default `http://localhost:5173`). Use the nav links:

- **Overview** — runtime phase
- **Plugins** — discovered packages and `ui_dashboard` columns
- **Dashboard** — drag layout hosts or dashboard-capable plugins onto the drop zone;
  use **Refresh runtime** if you change manifests on disk

## Stop

Interrupt both terminals (`Ctrl+C`). No extra teardown is required for the default
`.fabric-data` dir used by `dev_serve_with_examples.sh`.
