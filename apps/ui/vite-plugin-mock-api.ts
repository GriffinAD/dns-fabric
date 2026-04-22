import type { Plugin } from "vite";

import { handleMockApi } from "./src/mock/handleMockApi";

/**
 * Serves OpenAPI-faithful mocks for /api/v1 during Vite dev and preview.
 */
export function mockApiPlugin(): Plugin {
  return {
    name: "kea-fabric-mock-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleMockApi(req, res).then((handled) => {
          if (!handled) next();
        });
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleMockApi(req, res).then((handled) => {
          if (!handled) next();
        });
      });
    },
  };
}
