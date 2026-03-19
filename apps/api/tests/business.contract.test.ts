import "dotenv/config";

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

import type {
  CategoriesResponse,
  SummaryResponse,
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

interface SeedTransactionInput {
  amountCents: number;
  categorySlug: string;
  createdAt?: Date;
  remarks?: string | null;
  transactionDate: string;
  type: "income" | "expense";
  updatedAt?: Date;
}

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

async function seedDemoTransactions(records: SeedTransactionInput[]) {
  const { pool, database, demoUser, categoryBySlug } = await getSeededContext();

  try {
    const insertedTransactions = await database
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
      .returning({
        id: transactions.id,
        categoryId: transactions.categoryId,
      });

    return insertedTransactions;
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

  it("rejects unauthenticated access to protected business routes", async () => {
    const expenseCategoryId = await getCategoryIdBySlug("food");
    const transactionId = randomUUID();
    const requests = [
      requestJson(baseUrl, "/api/categories"),
      requestJson(baseUrl, "/api/transactions"),
      requestJson(baseUrl, `/api/transactions/${transactionId}`),
      requestJson(baseUrl, "/api/summary"),
      requestJson(baseUrl, "/api/transactions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "expense",
          amountCents: 1200,
          categoryId: expenseCategoryId,
          transactionDate: "2026-03-20",
        }),
      }),
      requestJson(baseUrl, `/api/transactions/${transactionId}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "expense",
          amountCents: 1200,
          categoryId: expenseCategoryId,
          transactionDate: "2026-03-20",
        }),
      }),
      requestJson(baseUrl, `/api/transactions/${transactionId}`, {
        method: "DELETE",
      }),
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

  it("creates a transaction and returns the shared contract shape", async () => {
    const expenseCategoryId = await getCategoryIdBySlug("food");
    const response = await requestJson<Transaction>(baseUrl, "/api/transactions", {
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

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      type: "expense",
      amountCents: 5500,
      currency: "HKD",
      categoryId: expenseCategoryId,
      categorySlug: "food",
      categoryName: "Food",
      transactionDate: "2026-03-20",
      remarks: "Lunch",
      source: "manual",
      externalRef: null,
    });
  });

  it("rejects invalid transaction creation payloads with structured validation errors", async () => {
    const expenseCategoryId = await getCategoryIdBySlug("food");
    const response = await requestJson<{
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

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request body failed validation",
    });
    expect(response.body?.details?.fieldErrors?.amountCents).toEqual([
      "Amount must be greater than zero",
    ]);
  });

  it("rejects missing and mismatched categories on creation", async () => {
    const expenseCategoryId = await getCategoryIdBySlug("food");
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
    expect(missingCategoryResponse.body).toEqual({
      code: "NOT_FOUND",
      message: "Category not found",
    });

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
    expect(pagedResponse.body?.items.map((item) => item.remarks)).toEqual([
      "March salary",
      "Lunch",
    ]);

    const filteredResponse = await requestJson<TransactionListResponse>(
      baseUrl,
      "/api/transactions?type=expense&from=2026-03-20&to=2026-03-20&pageSize=10",
      {
        headers: {
          cookie: sessionCookie,
        },
      },
    );

    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body?.items.map((item) => item.remarks)).toEqual(["Lunch", "Bus fare"]);

    const emptyResponse = await requestJson<TransactionListResponse>(
      baseUrl,
      `/api/transactions?categoryId=${shoppingCategoryId}`,
      {
        headers: {
          cookie: sessionCookie,
        },
      },
    );

    expect(emptyResponse.status).toBe(200);
    expect(emptyResponse.body).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });

    expect(seededTransactions).toHaveLength(4);
  });

  it("rejects invalid list query ranges", async () => {
    const response = await requestJson<{
      code: string;
      details?: { fieldErrors?: Record<string, string[]> };
      message: string;
    }>(baseUrl, "/api/transactions?from=2026-03-21&to=2026-03-20", {
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request body failed validation",
    });
    expect(response.body?.details?.fieldErrors?.from).toEqual([
      "From date must be on or before to date",
    ]);
  });

  it("returns individual transactions and handles missing or malformed ids", async () => {
    const [seededTransaction] = await seedDemoTransactions([
      {
        type: "expense",
        amountCents: 4200,
        categorySlug: "food",
        transactionDate: "2026-03-20",
        remarks: "Dinner",
        createdAt: new Date("2026-03-20T19:00:00.000Z"),
      },
    ]);

    if (!seededTransaction) {
      throw new Error("Expected a seeded transaction id.");
    }

    const successResponse = await requestJson<Transaction>(
      baseUrl,
      `/api/transactions/${seededTransaction.id}`,
      {
        headers: {
          cookie: sessionCookie,
        },
      },
    );

    expect(successResponse.status).toBe(200);
    expect(successResponse.body).toMatchObject({
      id: seededTransaction.id,
      remarks: "Dinner",
      categorySlug: "food",
    });

    const missingResponse = await requestJson<{ code: string; message: string }>(
      baseUrl,
      `/api/transactions/${randomUUID()}`,
      {
        headers: {
          cookie: sessionCookie,
        },
      },
    );

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body).toEqual({
      code: "NOT_FOUND",
      message: "Transaction not found",
    });

    const malformedResponse = await requestJson<{
      code: string;
      details?: { fieldErrors?: Record<string, string[]> };
      message: string;
    }>(baseUrl, "/api/transactions/not-a-uuid", {
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(malformedResponse.status).toBe(400);
    expect(malformedResponse.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request body failed validation",
    });
    expect(malformedResponse.body?.details?.fieldErrors?.id).toEqual([
      "Transaction ID must be a valid UUID",
    ]);
  });

  it("updates transactions and preserves error behavior for invalid updates", async () => {
    const [seededTransaction] = await seedDemoTransactions([
      {
        type: "expense",
        amountCents: 4200,
        categorySlug: "food",
        transactionDate: "2026-03-20",
        remarks: "Dinner",
        createdAt: new Date("2026-03-20T19:00:00.000Z"),
      },
    ]);

    if (!seededTransaction) {
      throw new Error("Expected a seeded transaction id.");
    }

    const transportCategoryId = await getCategoryIdBySlug("transport");
    const expenseCategoryId = await getCategoryIdBySlug("food");

    const successResponse = await requestJson<Transaction>(
      baseUrl,
      `/api/transactions/${seededTransaction.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({
          type: "expense",
          amountCents: 5800,
          categoryId: transportCategoryId,
          transactionDate: "2026-03-22",
          remarks: "Taxi",
        }),
      },
    );

    expect(successResponse.status).toBe(200);
    expect(successResponse.body).toMatchObject({
      id: seededTransaction.id,
      amountCents: 5800,
      categoryId: transportCategoryId,
      categorySlug: "transport",
      remarks: "Taxi",
      transactionDate: "2026-03-22",
    });

    const validationResponse = await requestJson<{
      code: string;
      details?: { fieldErrors?: Record<string, string[]> };
      message: string;
    }>(baseUrl, `/api/transactions/${seededTransaction.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        type: "expense",
        amountCents: 0,
        categoryId: expenseCategoryId,
        transactionDate: "2026-03-22",
      }),
    });

    expect(validationResponse.status).toBe(400);
    expect(validationResponse.body?.details?.fieldErrors?.amountCents).toEqual([
      "Amount must be greater than zero",
    ]);

    const missingCategoryResponse = await requestJson<{ code: string; message: string }>(
      baseUrl,
      `/api/transactions/${seededTransaction.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({
          type: "expense",
          amountCents: 5800,
          categoryId: randomUUID(),
          transactionDate: "2026-03-22",
        }),
      },
    );

    expect(missingCategoryResponse.status).toBe(404);
    expect(missingCategoryResponse.body).toEqual({
      code: "NOT_FOUND",
      message: "Category not found",
    });

    const mismatchResponse = await requestJson<{ code: string; message: string }>(
      baseUrl,
      `/api/transactions/${seededTransaction.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({
          type: "income",
          amountCents: 5800,
          categoryId: expenseCategoryId,
          transactionDate: "2026-03-22",
        }),
      },
    );

    expect(mismatchResponse.status).toBe(409);
    expect(mismatchResponse.body).toEqual({
      code: "CONFLICT",
      message: "Transaction type does not match category type",
    });

    const missingTransactionResponse = await requestJson<{ code: string; message: string }>(
      baseUrl,
      `/api/transactions/${randomUUID()}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({
          type: "expense",
          amountCents: 5800,
          categoryId: expenseCategoryId,
          transactionDate: "2026-03-22",
        }),
      },
    );

    expect(missingTransactionResponse.status).toBe(404);
    expect(missingTransactionResponse.body).toEqual({
      code: "NOT_FOUND",
      message: "Transaction not found",
    });
  });

  it("deletes transactions and returns not found after repeated deletion", async () => {
    const [seededTransaction] = await seedDemoTransactions([
      {
        type: "expense",
        amountCents: 4200,
        categorySlug: "food",
        transactionDate: "2026-03-20",
        remarks: "Dinner",
        createdAt: new Date("2026-03-20T19:00:00.000Z"),
      },
    ]);

    if (!seededTransaction) {
      throw new Error("Expected a seeded transaction id.");
    }

    const deleteResponse = await requestJson<null>(
      baseUrl,
      `/api/transactions/${seededTransaction.id}`,
      {
        method: "DELETE",
        headers: {
          cookie: sessionCookie,
        },
      },
    );

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.body).toBeNull();

    const secondDeleteResponse = await requestJson<{ code: string; message: string }>(
      baseUrl,
      `/api/transactions/${seededTransaction.id}`,
      {
        method: "DELETE",
        headers: {
          cookie: sessionCookie,
        },
      },
    );

    expect(secondDeleteResponse.status).toBe(404);
    expect(secondDeleteResponse.body).toEqual({
      code: "NOT_FOUND",
      message: "Transaction not found",
    });
  });

  it("returns summary totals for zero state and after create, update, and delete", async () => {
    const salaryCategoryId = await getCategoryIdBySlug("salary");
    const billsCategoryId = await getCategoryIdBySlug("bills");

    const initialSummary = await requestJson<SummaryResponse>(baseUrl, "/api/summary", {
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(initialSummary.status).toBe(200);
    expect(initialSummary.body).toEqual({
      totalIncomeCents: 0,
      totalExpenseCents: 0,
      balanceCents: 0,
      currency: "HKD",
    });

    const createdIncome = await requestJson<Transaction>(baseUrl, "/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        type: "income",
        amountCents: 200_000,
        categoryId: salaryCategoryId,
        transactionDate: "2026-03-20",
        remarks: "Salary",
      }),
    });

    expect(createdIncome.status).toBe(201);

    const createdExpense = await requestJson<Transaction>(baseUrl, "/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        type: "expense",
        amountCents: 9_500,
        categoryId: billsCategoryId,
        transactionDate: "2026-03-20",
        remarks: "Utilities",
      }),
    });

    expect(createdExpense.status).toBe(201);

    const summaryAfterCreate = await requestJson<SummaryResponse>(baseUrl, "/api/summary", {
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(summaryAfterCreate.body).toEqual({
      totalIncomeCents: 200_000,
      totalExpenseCents: 9_500,
      balanceCents: 190_500,
      currency: "HKD",
    });

    if (!createdExpense.body) {
      throw new Error("Expected created expense transaction.");
    }

    const updatedExpense = await requestJson<Transaction>(
      baseUrl,
      `/api/transactions/${createdExpense.body.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({
          type: "expense",
          amountCents: 15_000,
          categoryId: billsCategoryId,
          transactionDate: "2026-03-20",
          remarks: "Utilities",
        }),
      },
    );

    expect(updatedExpense.status).toBe(200);

    const summaryAfterUpdate = await requestJson<SummaryResponse>(baseUrl, "/api/summary", {
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(summaryAfterUpdate.body).toEqual({
      totalIncomeCents: 200_000,
      totalExpenseCents: 15_000,
      balanceCents: 185_000,
      currency: "HKD",
    });

    const deleteIncomeResponse = await requestJson<null>(
      baseUrl,
      `/api/transactions/${createdIncome.body?.id}`,
      {
        method: "DELETE",
        headers: {
          cookie: sessionCookie,
        },
      },
    );

    expect(deleteIncomeResponse.status).toBe(204);

    const finalSummary = await requestJson<SummaryResponse>(baseUrl, "/api/summary", {
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(finalSummary.body).toEqual({
      totalIncomeCents: 0,
      totalExpenseCents: 15_000,
      balanceCents: -15_000,
      currency: "HKD",
    });
  });
});
