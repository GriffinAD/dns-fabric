import type { Plugin } from "vite";

import { mockRoutes } from "./src/mock/routes";

/**
 * Serves OpenAPI-faithful JSON for GET /api/v1/* during Vite dev and preview.
 */
export function mockApiPlugin(): Plugin {
  return {
    name: "kea-fabric-mock-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "";
        if (!raw.startsWith("/api/v1")) {
          next();
          return;
        }
        const pathOnly = raw.split("?")[0] ?? raw;
        const body = mockRoutes[pathOnly];
        if (body === undefined) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "not_found", path: pathOnly }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "";
        if (!raw.startsWith("/api/v1")) {
          next();
          return;
        }
        const pathOnly = raw.split("?")[0] ?? raw;
        const body = mockRoutes[pathOnly];
        if (body === undefined) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "not_found", path: pathOnly }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
      });
    },
  };
}
