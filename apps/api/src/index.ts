import "./env.js";

import type { Server } from "node:http";

import { createApp } from "./app.js";
import { loadApiConfig } from "./config.js";

export async function startApiServer(): Promise<{
  close: () => Promise<void>;
  server: Server;
}> {
  const config = loadApiConfig();
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
