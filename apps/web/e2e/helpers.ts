import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AddressInfo, Server as NodeHttpServer } from "node:http";
import react from "@vitejs/plugin-react";
import { type InlineConfig, type ViteDevServer, createServer as createViteServer } from "vite";

import { startServer, stopServer } from "../../api/tests/http-test.js";
import {
  createTestApiConfig,
  demoPassword,
  demoUsername,
  ensureTestDatabaseAvailable,
  prepareSeededTestDatabase,
} from "../../api/tests/test-database.js";

function getServerBaseUrl(server: NodeHttpServer, label: string): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error(`Expected the ${label} server to bind to a TCP port.`);
  }

  return `http://127.0.0.1:${address.port}`;
}

function createWebServerConfig(apiBaseUrl: string): InlineConfig {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const webRoot = path.resolve(currentDirectory, "..");

  return {
    appType: "spa",
    configFile: false,
    logLevel: "error",
    plugins: [react()],
    root: webRoot,
    server: {
      host: "127.0.0.1",
      port: 0,
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
        },
      },
    },
  };
}

export interface E2EStack {
  apiBaseUrl: string;
  close: () => Promise<void>;
  demoPassword: string;
  demoUsername: string;
  webBaseUrl: string;
}

export async function startE2EStack(): Promise<E2EStack> {
  await ensureTestDatabaseAvailable();
  await prepareSeededTestDatabase();

  const startedApiServer = await startServer(createTestApiConfig());
  const apiBaseUrl = startedApiServer.baseUrl;

  let webServer: ViteDevServer | undefined;

  try {
    webServer = await createViteServer(createWebServerConfig(apiBaseUrl));
    await webServer.listen();
  } catch (error) {
    await stopServer(startedApiServer.server);
    await startedApiServer.runtime.close();
    throw error;
  }

  const httpServer = webServer.httpServer;

  if (!httpServer) {
    await webServer.close();
    await stopServer(startedApiServer.server);
    await startedApiServer.runtime.close();
    throw new Error("Expected the Vite dev server to expose an HTTP server.");
  }

  return {
    apiBaseUrl,
    demoPassword,
    demoUsername,
    webBaseUrl: getServerBaseUrl(httpServer, "web"),
    close: async () => {
      await webServer.close();
      await stopServer(startedApiServer.server);
      await startedApiServer.runtime.close();
    },
  };
}
