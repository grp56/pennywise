import "dotenv/config";

import type { Server } from "node:http";

import type { CategoriesResponse } from "@pennywise/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { createApp } from "../src/app.js";
import { loginAsDemo, requestJson, startServer, stopServer } from "./http-test.js";
import { prepareSeededTestDatabase, testDatabaseUrl, testSessionSecret } from "./test-database.js";

const orderedCategorySlugs = [
  "allowance",
  "bonus",
  "gift",
  "other-income",
  "salary",
  "bills",
  "education",
  "entertainment",
  "food",
  "healthcare",
  "other-expense",
  "shopping",
  "transport",
];

describe.sequential("business contract", () => {
  let runtime: ReturnType<typeof createApp> | undefined;
  let server: Server | undefined;
  let baseUrl = "";
  let sessionCookie = "";

  beforeEach(async () => {
    await prepareSeededTestDatabase();

    const startedServer = await startServer({
      connectionString: testDatabaseUrl,
      nodeEnv: "test",
      port: 0,
      sessionSecret: testSessionSecret,
    });

    runtime = startedServer.runtime;
    server = startedServer.server;
    baseUrl = startedServer.baseUrl;
    sessionCookie = await loginAsDemo(baseUrl);
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

  it("rejects unauthenticated access to categories", async () => {
    const response = await requestJson<{ code: string; message: string }>(baseUrl, "/api/categories");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  });

  it("returns the seeded categories in stable display order", async () => {
    const response = await requestJson<CategoriesResponse>(baseUrl, "/api/categories", {
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body?.map((category) => category.slug)).toEqual(orderedCategorySlugs);
  });
});
