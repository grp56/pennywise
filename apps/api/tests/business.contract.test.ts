import "dotenv/config";

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

import type { CategoriesResponse, Transaction } from "@pennywise/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { createApp } from "../src/app.js";
import { loginAsDemo, requestJson, startServer, stopServer } from "./http-test.js";
import {
  getSeededContext,
  prepareSeededTestDatabase,
  testDatabaseUrl,
  testSessionSecret,
} from "./test-database.js";

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

async function getCategoryIdBySlug(slug: string): Promise<string> {
  const { pool, categoryBySlug } = await getSeededContext();

  try {
    const category = categoryBySlug.get(slug);

    if (!category) {
      throw new Error(`Expected seeded category '${slug}' to exist.`);
    }

    return category.id;
  } finally {
    await pool.end();
  }
}

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

  it("rejects unauthenticated access to categories and transaction CRUD routes", async () => {
    const expenseCategoryId = await getCategoryIdBySlug("food");
    const transactionId = randomUUID();
    const requests = [
      requestJson(baseUrl, "/api/categories"),
      requestJson(baseUrl, "/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "expense",
          amountCents: 1200,
          categoryId: expenseCategoryId,
          transactionDate: "2026-03-20",
        }),
      }),
      requestJson(baseUrl, `/api/transactions/${transactionId}`),
      requestJson(baseUrl, `/api/transactions/${transactionId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "expense",
          amountCents: 1200,
          categoryId: expenseCategoryId,
          transactionDate: "2026-03-20",
        }),
      }),
      requestJson(baseUrl, `/api/transactions/${transactionId}`, { method: "DELETE" }),
    ];

    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }
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

  it("creates, reads, updates, and deletes a transaction", async () => {
    const expenseCategoryId = await getCategoryIdBySlug("food");
    const transportCategoryId = await getCategoryIdBySlug("transport");
    const createResponse = await requestJson<Transaction>(baseUrl, "/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        type: "expense",
        amountCents: 5500,
        categoryId: expenseCategoryId,
        transactionDate: "2026-03-20",
        remarks: "Lunch",
      }),
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      type: "expense",
      amountCents: 5500,
      categorySlug: "food",
    });

    const transactionId = createResponse.body?.id;
    expect(transactionId).toBeTruthy();

    const readResponse = await requestJson<Transaction>(
      baseUrl,
      `/api/transactions/${transactionId}`,
      { headers: { cookie: sessionCookie } },
    );
    expect(readResponse.status).toBe(200);

    const updateResponse = await requestJson<Transaction>(
      baseUrl,
      `/api/transactions/${transactionId}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({
          type: "expense",
          amountCents: 3200,
          categoryId: transportCategoryId,
          transactionDate: "2026-03-21",
          remarks: "Bus fare",
        }),
      },
    );
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      amountCents: 3200,
      categorySlug: "transport",
    });

    const deleteResponse = await requestJson<null>(baseUrl, `/api/transactions/${transactionId}`, {
      method: "DELETE",
      headers: {
        cookie: sessionCookie,
      },
    });
    expect(deleteResponse.status).toBe(204);
  });

  it("rejects invalid, missing, and mismatched transaction inputs", async () => {
    const expenseCategoryId = await getCategoryIdBySlug("food");
    const invalidResponse = await requestJson<{
      code: string;
      details?: { fieldErrors?: Record<string, string[]> };
      message: string;
    }>(baseUrl, "/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        type: "expense",
        amountCents: 0,
        categoryId: expenseCategoryId,
        transactionDate: "2026-03-20",
      }),
    });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body?.details?.fieldErrors?.amountCents).toEqual([
      "Amount must be greater than zero",
    ]);

    const missingCategoryResponse = await requestJson<{ code: string; message: string }>(
      baseUrl,
      "/api/transactions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({
          type: "expense",
          amountCents: 5500,
          categoryId: randomUUID(),
          transactionDate: "2026-03-20",
        }),
      },
    );
    expect(missingCategoryResponse.status).toBe(404);

    const mismatchResponse = await requestJson<{ code: string; message: string }>(
      baseUrl,
      "/api/transactions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({
          type: "income",
          amountCents: 5500,
          categoryId: expenseCategoryId,
          transactionDate: "2026-03-20",
        }),
      },
    );
    expect(mismatchResponse.status).toBe(409);
    expect(mismatchResponse.body).toEqual({
      code: "CONFLICT",
      message: "Transaction type does not match category type",
    });
  });
});
