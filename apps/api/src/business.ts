import type { CategoriesResponse, TransactionType } from "@pennywise/contracts";
import { categoriesResponseSchema } from "@pennywise/contracts";
import { sql } from "drizzle-orm";
import { Router } from "express";

import { requireAuthenticatedUser } from "./auth.js";
import type { ApiDatabase } from "./db/client.js";
import { categories } from "./db/schema.js";

type CategoryRecord = Pick<typeof categories.$inferSelect, "id" | "slug" | "name" | "type">;

function mapCategory(record: CategoryRecord) {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    type: record.type,
  };
}

export function isCategoryCompatible(categoryType: TransactionType, transactionType: TransactionType) {
  return categoryType === transactionType;
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

  return router;
}
