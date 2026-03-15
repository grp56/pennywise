import "dotenv/config";

import type { Server } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { createApp } from "../src/app.js";
import { requestJson, startServer, stopServer } from "./http-test.js";
import {
  demoPassword,
  demoUsername,
  prepareSeededTestDatabase,
  testDatabaseUrl,
  testSessionSecret,
} from "./test-database.js";

describe.sequential("auth contract", () => {
  let runtime: ReturnType<typeof createApp> | undefined;
  let server: Server | undefined;
  let baseUrl = "";

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

  it("authenticates valid seeded credentials and returns a session cookie", async () => {
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

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      user: {
        username: demoUsername,
      },
    });

    const sessionCookie = response.headers.get("set-cookie");

    expect(sessionCookie).toContain("connect.sid=");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).not.toContain("Secure");
  });

  it("rejects malformed login payloads with structured validation errors", async () => {
    const response = await requestJson<{
      code: string;
      message: string;
      details?: { fieldErrors?: Record<string, string[]> };
    }>(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "",
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request body failed validation",
    });
    expect(response.body?.details?.fieldErrors?.username).toEqual(["Username is required"]);
    expect(response.body?.details?.fieldErrors?.password).toEqual(["Required"]);
  });

  it("rejects invalid credentials", async () => {
    const response = await requestJson<{ code: string; message: string }>(
      baseUrl,
      "/api/auth/login",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: demoUsername,
          password: "wrong-password",
        }),
      },
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "UNAUTHORIZED",
      message: "Invalid username or password",
    });
  });

  it("rejects unauthenticated me requests", async () => {
    const response = await requestJson<{ code: string; message: string }>(baseUrl, "/api/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  });

  it("returns the current session user after login", async () => {
    const loginResponse = await requestJson<{ user: { id: string; username: string } }>(
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

    const sessionCookie = loginResponse.headers.get("set-cookie");

    expect(sessionCookie).toBeTruthy();

    const meResponse = await requestJson<{ user: { id: string; username: string } }>(
      baseUrl,
      "/api/me",
      {
        headers: {
          cookie: sessionCookie?.split(";", 1)[0] ?? "",
        },
      },
    );

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toMatchObject({
      user: {
        username: demoUsername,
      },
    });
  });

  it("destroys the session on logout", async () => {
    const loginResponse = await requestJson<{ user: { id: string; username: string } }>(
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

    const sessionCookie = loginResponse.headers.get("set-cookie");

    expect(sessionCookie).toBeTruthy();

    const logoutResponse = await requestJson<null>(baseUrl, "/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: sessionCookie?.split(";", 1)[0] ?? "",
      },
    });

    expect(logoutResponse.status).toBe(204);

    const meResponse = await requestJson<{ code: string; message: string }>(baseUrl, "/api/me", {
      headers: {
        cookie: sessionCookie?.split(";", 1)[0] ?? "",
      },
    });

    expect(meResponse.status).toBe(401);
    expect(meResponse.body).toEqual({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  });
});
