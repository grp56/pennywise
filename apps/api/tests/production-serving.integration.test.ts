import "../src/env.js";

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { createApp } from "../src/app.js";
import { requestJson, startServer, stopServer } from "./http-test.js";
import {
  createTestApiConfig,
  ensureTestDatabaseAvailable,
  prepareSeededTestDatabase,
} from "./test-database.js";

const execFileAsync = promisify(execFile);
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDirectory, "..", "..", "..");
const webDistDirectory = path.resolve(repoRoot, "apps", "web", "dist");
const webIndexPath = path.join(webDistDirectory, "index.html");

interface TextResponse {
  body: string;
  headers: Headers;
  status: number;
}

function getFirstAssetPath(indexHtml: string): string {
  const assetMatch = indexHtml.match(/(?:src|href)="([^"]*\/assets\/[^"]+)"/);

  if (!assetMatch?.[1]) {
    throw new Error("Expected the built web index.html to reference at least one hashed asset.");
  }

  return assetMatch[1];
}

async function buildWebApp(): Promise<void> {
  await execFileAsync("pnpm", ["--filter", "@pennywise/web", "build"], {
    cwd: repoRoot,
    env: process.env,
  });
}

async function requestText(
  baseUrl: string,
  requestPath: string,
  init?: RequestInit,
): Promise<TextResponse> {
  const response = await fetch(`${baseUrl}${requestPath}`, init);

  return {
    status: response.status,
    headers: response.headers,
    body: await response.text(),
  };
}

describe.sequential("production serving integration", () => {
  let runtime: ReturnType<typeof createApp> | undefined;
  let server: Server | undefined;
  let baseUrl = "";
  let builtIndexHtml = "";
  let builtAssetPath = "";

  beforeAll(async () => {
    await ensureTestDatabaseAvailable();
    await buildWebApp();

    builtIndexHtml = await readFile(webIndexPath, "utf8");
    builtAssetPath = getFirstAssetPath(builtIndexHtml);
  });

  beforeEach(async () => {
    await prepareSeededTestDatabase();

    const startedServer = await startServer(
      createTestApiConfig({
        nodeEnv: "production",
      }),
    );

    runtime = startedServer.runtime;
    server = startedServer.server;
    baseUrl = startedServer.baseUrl;
  });

  afterEach(async () => {
    if (server) {
      await stopServer(server);
      server = undefined;
    }

    if (runtime) {
      await runtime.close();
      runtime = undefined;
    }
  });

  it("preserves JSON auth behavior for /api routes in production mode", async () => {
    const response = await requestJson<{ code: string; message: string }>(baseUrl, "/api/me");

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.body).toEqual({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  });

  it("serves the built frontend shell for direct browser routes", async () => {
    const loginResponse = await requestText(baseUrl, "/login", {
      headers: {
        accept: "text/html",
      },
    });
    const dashboardResponse = await requestText(baseUrl, "/dashboard", {
      headers: {
        accept: "text/html",
      },
    });
    const editRouteResponse = await requestText(
      baseUrl,
      "/transactions/11111111-1111-4111-8111-111111111111/edit",
      {
        headers: {
          accept: "text/html",
        },
      },
    );

    for (const response of [loginResponse, dashboardResponse, editRouteResponse]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.body).toBe(builtIndexHtml);
    }
  });

  it("serves hashed frontend assets from the built web output", async () => {
    const response = await requestText(baseUrl, builtAssetPath);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body).not.toBe(builtIndexHtml);
  });
});
