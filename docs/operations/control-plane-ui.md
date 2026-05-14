# Pi-hole HA control plane UI (operator)

## Svelte dashboard (pi-fabric)

Rich operator UI lives in this repository under `apps/ui/`. Build the Pi-hole bundle with the multi-page Vite target `piholeCp`.

### Local dev against a running control plane

Point the Vite dev server at the node API using `VITE_PIHOLE_CP_BASE_URL` (browser `fetch` / `EventSource` base). Proxy rules in `apps/ui/vite.config.ts` forward `/dashboard`, `/v1`, `/logs`, and `/health` to a local control plane when `VITE_PIHOLE_CP_BASE_URL` is empty; set **`PIHOLE_CP_DEV_PROXY_TARGET`** (or `VITE_PIHOLE_CP_DEV_PROXY`) if the API is not on `http://127.0.0.1:8091`.

```bash
cd /path/to/pi-fabric/apps/ui
VITE_PIHOLE_CP_BASE_URL=http://192.0.2.4:8091 npm run dev -- --port 5174
```

Open `index-pihole-cp.html` (Vite serves it at `/index-pihole-cp.html`).

### Production build

```bash
cd /path/to/pi-fabric/apps/ui
npm ci
npm run build
```

Outputs include `dist/index-pihole-cp.html` and hashed assets under `dist/assets/`.

### Embed build for `pihole-ha` (`/next/`)

To produce a bundle that resolves under **`/next/`** on the control-plane host (see **`pihole-ha`** `scripts/sync-pihole-cp-ui.sh` and `docs/operations/control-plane-ui.md`):

```bash
cd /path/to/pi-fabric/apps/ui
npm ci
npm run build:pihole-cp-embed
```
