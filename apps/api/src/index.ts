import "./env.js";

import { access } from "node:fs/promises";
import type { Server } from "node:http";
import path from "node:path";

import { createApp } from "./app.js";
import { type ApiConfig, loadApiConfig } from "./config.js";

async function ensureFrontendAssetsAvailable(config: ApiConfig): Promise<void> {
  if (!config.serveFrontendAssets) {
    return;
  }

  const frontendIndexPath = path.join(config.frontendDistPath, "index.html");

  try {
    await access(frontendIndexPath);
  } catch (error) {
    throw new Error(
      `Frontend asset serving is enabled, but ${frontendIndexPath} is missing. Run "pnpm --filter @pennywise/web build" or "pnpm build" before starting the production server.`,
      {
        cause: error,
      },
    );
  }
}

export async function startApiServer(): Promise<{
  close: () => Promise<void>;
  server: Server;
}> {
  const config = loadApiConfig();
  await ensureFrontendAssetsAvailable(config);
  const runtime = createApp(config);

  const server = runtime.app.listen(config.port, () => {
    console.log(`API server listening on port ${config.port}`);
  });

  return {
    server,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      await runtime.close();
    },
  };
}

if (process.env.NODE_ENV !== "test") {
  startApiServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
