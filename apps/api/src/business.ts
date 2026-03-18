import type {
  CategoriesResponse,
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from "@pennywise/contracts";
import {
  categoriesResponseSchema,
  createTransactionInputSchema,
  transactionSchema,
  updateTransactionInputSchema,
} from "@pennywise/contracts";
import { and, eq, sql } from "drizzle-orm";
import { type Response, Router } from "express";
import { z } from "zod";

import { requireAuthenticatedUser } from "./auth.js";
import type { ApiDatabase } from "./db/client.js";
import { categories, transactions } from "./db/schema.js";
import { ApiHttpError, createConflictError, createNotFoundError, createValidationError } from "./errors.js";

const transactionIdParamsSchema = z
  .object({
    id: z.string().uuid("Transaction ID must be a valid UUID"),
  })
  .strict();

type CategoryRecord = Pick<typeof categories.$inferSelect, "id" | "slug" | "name" | "type">;

type TransactionRecord = Pick<
  typeof transactions.$inferSelect,
  | "id"
  | "userId"
  | "type"
  | "amountCents"
  | "currency"
  | "categoryId"
  | "transactionDate"
  | "remarks"
  | "source"
  | "externalRef"
  | "createdAt"
  | "updatedAt"
> & {
  categoryName: string;
  categorySlug: string;
};

function getAuthenticatedUserId(response: Response): string {
  const authUser = response.locals.authUser;

  if (!authUser) {
    throw new ApiHttpError(500, "INTERNAL_ERROR", "Authenticated user context is missing");
  }

  return authUser.id;
}

function parseCreateTransactionInput(body: unknown): CreateTransactionInput {
  const parsed = createTransactionInputSchema.safeParse(body);

  if (!parsed.success) {
    throw createValidationError(parsed.error);
  }

  return parsed.data;
}

function parseUpdateTransactionInput(body: unknown): UpdateTransactionInput {
  const parsed = updateTransactionInputSchema.safeParse(body);

  if (!parsed.success) {
    throw createValidationError(parsed.error);
  }

  return parsed.data;
}

function parseTransactionId(params: unknown): string {
  const parsed = transactionIdParamsSchema.safeParse(params);

  if (!parsed.success) {
    throw createValidationError(parsed.error);
  }

  return parsed.data.id;
}

function mapCategory(record: CategoryRecord) {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    type: record.type,
  };
}

function mapTransaction(record: TransactionRecord): Transaction {
  return transactionSchema.parse({
    id: record.id,
    userId: record.userId,
    type: record.type,
    amountCents: record.amountCents,
    currency: record.currency,
    categoryId: record.categoryId,
    categorySlug: record.categorySlug,
    categoryName: record.categoryName,
    transactionDate: record.transactionDate,
    remarks: record.remarks,
    source: record.source,
    externalRef: record.externalRef,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

async function getCategoryRecord(
  database: ApiDatabase,
  categoryId: string,
): Promise<CategoryRecord | undefined> {
  const [category] = await database
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      type: categories.type,
    })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  return category;
}

async function requireCategoryRecord(database: ApiDatabase, categoryId: string): Promise<CategoryRecord> {
  const category = await getCategoryRecord(database, categoryId);

  if (!category) {
    throw createNotFoundError("Category not found");
  }

  return category;
}

function assertCategoryCompatible(category: CategoryRecord, transactionType: Transaction["type"]): void {
  if (category.type !== transactionType) {
    throw createConflictError("Transaction type does not match category type");
  }
}

function getTransactionSelection() {
  return {
    id: transactions.id,
    userId: transactions.userId,
    type: transactions.type,
    amountCents: transactions.amountCents,
    currency: transactions.currency,
    categoryId: transactions.categoryId,
    categorySlug: categories.slug,
    categoryName: categories.name,
    transactionDate: transactions.transactionDate,
    remarks: transactions.remarks,
    source: transactions.source,
    externalRef: transactions.externalRef,
    createdAt: transactions.createdAt,
    updatedAt: transactions.updatedAt,
  };
}

async function getTransactionRecord(
  database: ApiDatabase,
  userId: string,
  transactionId: string,
): Promise<TransactionRecord | undefined> {
  const [transaction] = await database
    .select(getTransactionSelection())
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
    .limit(1);

  return transaction;
}

export function createBusinessRouter(database: ApiDatabase): Router {
  const router = Router();

  router.use(requireAuthenticatedUser);

  router.get("/categories", async (_request, response) => {
    const categoryRecords = await database
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        type: categories.type,
      })
      .from(categories)
      .orderBy(sql`case when ${categories.type} = 'income' then 0 else 1 end`, categories.name);

    const payload: CategoriesResponse = categoriesResponseSchema.parse(
      categoryRecords.map(mapCategory),
    );

    response.status(200).json(payload);
  });

  router.post("/transactions", async (request, response) => {
    const userId = getAuthenticatedUserId(response);
    const input = parseCreateTransactionInput(request.body);
    const category = await requireCategoryRecord(database, input.categoryId);

    assertCategoryCompatible(category, input.type);

    const [createdTransaction] = await database
      .insert(transactions)
      .values({
        userId,
        type: input.type,
        amountCents: input.amountCents,
        currency: "HKD",
        categoryId: input.categoryId,
        transactionDate: input.transactionDate,
        remarks: input.remarks ?? null,
        source: "manual",
        externalRef: null,
      })
      .returning({
        id: transactions.id,
        userId: transactions.userId,
        type: transactions.type,
        amountCents: transactions.amountCents,
        currency: transactions.currency,
        categoryId: transactions.categoryId,
        transactionDate: transactions.transactionDate,
        remarks: transactions.remarks,
        source: transactions.source,
        externalRef: transactions.externalRef,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
      });

    if (!createdTransaction) {
      throw new ApiHttpError(500, "INTERNAL_ERROR", "Transaction could not be created");
    }

    response.status(201).json(
      mapTransaction({
        ...createdTransaction,
        categorySlug: category.slug,
        categoryName: category.name,
      }),
    );
  });

  router.get("/transactions/:id", async (request, response) => {
    const userId = getAuthenticatedUserId(response);
    const transactionId = parseTransactionId(request.params);
    const transaction = await getTransactionRecord(database, userId, transactionId);

    if (!transaction) {
      throw createNotFoundError("Transaction not found");
    }

    response.status(200).json(mapTransaction(transaction));
  });

  router.put("/transactions/:id", async (request, response) => {
    const userId = getAuthenticatedUserId(response);
    const transactionId = parseTransactionId(request.params);
    const input = parseUpdateTransactionInput(request.body);
    const category = await requireCategoryRecord(database, input.categoryId);

    assertCategoryCompatible(category, input.type);

    const [updatedTransaction] = await database
      .update(transactions)
      .set({
        type: input.type,
        amountCents: input.amountCents,
        categoryId: input.categoryId,
        transactionDate: input.transactionDate,
        remarks: input.remarks ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
      .returning({
        id: transactions.id,
        userId: transactions.userId,
        type: transactions.type,
        amountCents: transactions.amountCents,
        currency: transactions.currency,
        categoryId: transactions.categoryId,
        transactionDate: transactions.transactionDate,
        remarks: transactions.remarks,
        source: transactions.source,
        externalRef: transactions.externalRef,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
      });

    if (!updatedTransaction) {
      throw createNotFoundError("Transaction not found");
    }

    response.status(200).json(
      mapTransaction({
        ...updatedTransaction,
        categorySlug: category.slug,
        categoryName: category.name,
      }),
    );
  });

  router.delete("/transactions/:id", async (request, response) => {
    const userId = getAuthenticatedUserId(response);
    const transactionId = parseTransactionId(request.params);
    const [deletedTransaction] = await database
      .delete(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
      .returning({ id: transactions.id });

    if (!deletedTransaction) {
      throw createNotFoundError("Transaction not found");
    }

    response.status(204).send();
  });

  return router;
}
