import { once } from "node:events";
import { type Server, createServer } from "node:http";

import { createApp } from "../src/app.js";
import type { ApiConfig } from "../src/config.js";
import { demoPassword, demoUsername } from "./test-database.js";

export interface JsonResponse<T> {
  body: T | null;
  headers: Headers;
  status: number;
}

export async function startServer(config: ApiConfig) {
  const runtime = createApp(config);
  const server = createServer(runtime.app);

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected test server to bind to a TCP port.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    runtime,
  };
}

export async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<JsonResponse<T>> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();

  return {
    status: response.status,
    headers: response.headers,
    body: text === "" ? null : (JSON.parse(text) as T),
  };
}

export async function loginAsDemo(baseUrl: string): Promise<string> {
  const response = await requestJson<{ user: { id: string; username: string } }>(
    baseUrl,
    "/api/auth/login",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: demoUsername,
        password: demoPassword,
      }),
    },
  );

  const sessionCookie = response.headers.get("set-cookie")?.split(";", 1)[0];

  if (response.status !== 200 || !sessionCookie) {
    throw new Error("Expected seeded demo login to succeed.");
  }

  return sessionCookie;
}
