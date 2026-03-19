import "dotenv/config";

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

import type {
  CategoriesResponse,
  Transaction,
  TransactionListResponse,
} from "@pennywise/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { createApp } from "../src/app.js";
import { transactions } from "../src/db/schema.js";
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

interface SeedTransactionInput {
  amountCents: number;
  categorySlug: string;
  createdAt?: Date;
  remarks?: string | null;
  transactionDate: string;
  type: "income" | "expense";
  updatedAt?: Date;
}

async function seedDemoTransactions(records: SeedTransactionInput[]) {
  const { pool, database, demoUser, categoryBySlug } = await getSeededContext();

  try {
    return await database
      .insert(transactions)
      .values(
        records.map((record) => {
          const category = categoryBySlug.get(record.categorySlug);

          if (!category) {
            throw new Error(`Expected seeded category '${record.categorySlug}' to exist.`);
          }

          return {
            userId: demoUser.id,
            type: record.type,
            amountCents: record.amountCents,
            currency: "HKD",
            categoryId: category.id,
            transactionDate: record.transactionDate,
            remarks: record.remarks ?? null,
            source: "manual" as const,
            externalRef: null,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt ?? record.createdAt,
          };
        }),
      )
      .returning({ id: transactions.id });
  } finally {
    await pool.end();
  }
}

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

  it("rejects unauthenticated access to business routes that exist so far", async () => {
    const expenseCategoryId = await getCategoryIdBySlug("food");
    const transactionId = randomUUID();
    const requests = [
      requestJson(baseUrl, "/api/categories"),
      requestJson(baseUrl, "/api/transactions"),
      requestJson(baseUrl, `/api/transactions/${transactionId}`),
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

    const transactionId = createResponse.body?.id ?? "";
    expect(createResponse.status).toBe(201);

    expect(
      await requestJson<Transaction>(baseUrl, `/api/transactions/${transactionId}`, {
        headers: { cookie: sessionCookie },
      }),
    ).toMatchObject({ status: 200 });

    expect(
      await requestJson<Transaction>(baseUrl, `/api/transactions/${transactionId}`, {
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
      }),
    ).toMatchObject({ status: 200 });

    expect(
      await requestJson<null>(baseUrl, `/api/transactions/${transactionId}`, {
        method: "DELETE",
        headers: { cookie: sessionCookie },
      }),
    ).toMatchObject({ status: 204 });
  });

  it("lists transactions with ordering, filters, pagination, and empty states", async () => {
    const shoppingCategoryId = await getCategoryIdBySlug("shopping");
    const seededTransactions = await seedDemoTransactions([
      {
        type: "income",
        amountCents: 200_000,
        categorySlug: "salary",
        transactionDate: "2026-03-21",
        remarks: "March salary",
        createdAt: new Date("2026-03-21T09:00:00.000Z"),
      },
      {
        type: "expense",
        amountCents: 5500,
        categorySlug: "food",
        transactionDate: "2026-03-20",
        remarks: "Lunch",
        createdAt: new Date("2026-03-20T12:00:00.000Z"),
      },
      {
        type: "expense",
        amountCents: 3200,
        categorySlug: "transport",
        transactionDate: "2026-03-20",
        remarks: "Bus fare",
        createdAt: new Date("2026-03-20T08:00:00.000Z"),
      },
      {
        type: "income",
        amountCents: 8000,
        categorySlug: "gift",
        transactionDate: "2026-03-19",
        remarks: "Birthday gift",
        createdAt: new Date("2026-03-19T11:00:00.000Z"),
      },
    ]);

    const pagedResponse = await requestJson<TransactionListResponse>(
      baseUrl,
      "/api/transactions?page=1&pageSize=2",
      {
        headers: {
          cookie: sessionCookie,
        },
      },
    );

    expect(pagedResponse.status).toBe(200);
    expect(pagedResponse.body).toMatchObject({
      page: 1,
      pageSize: 2,
      totalItems: 4,
      totalPages: 2,
    });
    expect(pagedResponse.body?.items.map((item) => item.id)).toEqual([
      seededTransactions[0]?.id,
      seededTransactions[1]?.id,
    ]);

    const filteredResponse = await requestJson<TransactionListResponse>(
      baseUrl,
      `/api/transactions?type=expense&categoryId=${shoppingCategoryId}`,
      {
        headers: {
          cookie: sessionCookie,
        },
      },
    );
    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body?.items).toEqual([]);

    const invalidRangeResponse = await requestJson<{ code: string; message: string }>(
      baseUrl,
      "/api/transactions?from=2026-03-22&to=2026-03-20",
      {
        headers: {
          cookie: sessionCookie,
        },
      },
    );
    expect(invalidRangeResponse.status).toBe(400);
    expect(invalidRangeResponse.body).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
