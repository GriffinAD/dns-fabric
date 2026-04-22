# Kea Fabric operator UI

Vite + Svelte 5 bootstrap for the operator shell. Local dev proxies `/api` to
`http://127.0.0.1:8080` (see `vite.config.ts`).

```bash
npm ci
npm run dev
```

```bash
npm run check:ui-unit
npm run check:ui-e2e
```

See [docs/operator-demo.md](../../docs/operator-demo.md).
