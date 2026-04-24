# Kea Fabric operator UI

Vite + Svelte 5 bootstrap for the operator shell. Local dev proxies `/api` to
`http://127.0.0.1:8080` (see `vite.config.ts`). Requests under **`/api/v1`** are
handled first by the **Vite mock middleware** (`vite-plugin-mock-api.ts`), which
serves JSON aligned with `specs/api/openapi.yaml` from `src/mock/fixtures.ts`.

Mock extras (**simulate mode**): DHCP/discovery list payloads are generated once per dev server
(stable IPs and timestamps); **`GET /api/v1/perf/summary`** and SSE **`fabric.perf.updated`**
carry synthetic, tick-advancing CPU/RAM/network/disk (see `src/mock/perfSimulate.ts`). With
**`KEA_FABRIC_UI_PROXY_API=1`**, the mock is skipped and a real API answers instead.

- **`GET /api/v1/events/stream`** — `text/event-stream` with synthetic
  `fabric.perf.updated` events (used by `DataGateway.subscribeFabricEvents`).
- **`PUT /api/v1/dashboards/{id}/layout`** — accepts a layout body; stored in
  memory for the dev server process.
- **`GET /api/v1/discovery/scan`** / **`POST /api/v1/discovery/scan/pause`** —
  scan state for the discovery toolbar.
- **List GET** query **`?mock=empty`** returns `{ items: [] }` for pool/client/reservation/record lists; **`?mock=error`** returns HTTP 503.

```bash
npm ci
npm run dev
```

```bash
npm run check:ui-unit
npm run check:ui-e2e
```

End-to-end specs use the `*.e2e.ts` suffix so Vitest (which matches `*.{test,spec}.ts`)
does not treat Playwright files as unit tests when tools scan from the repo root.

`src/lib/api/openapiZod.ts` + `openapiZod.test.ts` validate `src/mock/fixtures.ts` against
Zod schemas aligned with `specs/api/openapi.yaml` (fail-fast when mocks drift).

See [docs/operator-demo.md](../../docs/operator-demo.md).
