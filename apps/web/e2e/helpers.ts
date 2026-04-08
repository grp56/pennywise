import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { type InlineConfig, type ViteDevServer, createServer as createViteServer } from "vite";

import {
  type StartedTestServer,
  closeStartedServer,
  getServerBaseUrl,
  startServer,
} from "../../api/tests/http-test.js";
import {
  createTestApiConfig,
  demoPassword,
  demoUsername,
  ensureTestDatabaseAvailable,
  prepareSeededTestDatabase,
} from "../../api/tests/test-database.js";

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

async function closeE2EStack(
  startedApiServer: StartedTestServer,
  webServer: ViteDevServer,
): Promise<void> {
  await webServer.close();
  await closeStartedServer(startedApiServer);
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
    await startedApiServer.close();
    throw error;
  }

  const httpServer = webServer.httpServer;

  if (!httpServer) {
    await webServer.close();
    await startedApiServer.close();
    throw new Error("Expected the Vite dev server to expose an HTTP server.");
  }

  return {
    apiBaseUrl,
    demoPassword,
    demoUsername,
    webBaseUrl: getServerBaseUrl(httpServer, "web"),
    close: async () => {
      await closeE2EStack(startedApiServer, webServer);
    },
  };
}
