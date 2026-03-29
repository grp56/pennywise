import "../src/env.js";

import bcrypt from "bcryptjs";
import { count, eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, createPool, getRequiredConnectionString } from "../src/db/client.js";
import { migrateDatabase } from "../src/db/migrate.js";
import { categories, transactions, users } from "../src/db/schema.js";
import { seedCategories } from "../src/db/seed-data.js";
import { getPersistedSummary } from "../src/db/summary.js";
import {
  demoPassword,
  demoUsername,
  ensureTestDatabaseAvailable,
  getSeededContext,
  resetTestDatabase,
  seedTestDatabase,
  testDatabaseUrl,
} from "./test-database.js";

describe.sequential("database persistence", () => {
  beforeAll(async () => {
    await ensureTestDatabaseAvailable(testDatabaseUrl);
  });

  beforeEach(async () => {
    await resetTestDatabase(testDatabaseUrl);
    await migrateDatabase(testDatabaseUrl);
  });

  it("creates the required tables and indexes", async () => {
    const pool = createPool(testDatabaseUrl);

    try {
      const tablesResult = await pool.query<{
        table_name: string;
      }>(`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
        order by table_name
      `);

      expect(tablesResult.rows.map((row) => row.table_name)).toEqual(
        expect.arrayContaining([
          "app_migrations",
          "categories",
          "session",
          "transactions",
          "users",
        ]),
      );

      const indexesResult = await pool.query<{
        indexname: string;
      }>(`
        select indexname
        from pg_indexes
        where schemaname = 'public'
        order by indexname
      `);

      expect(indexesResult.rows.map((row) => row.indexname)).toEqual(
        expect.arrayContaining([
          "IDX_session_expire",
          "categories_slug_unique",
          "session_pkey",
          "transactions_pkey",
          "transactions_user_category_idx",
          "transactions_user_external_ref_unique",
          "transactions_user_transaction_date_created_at_idx",
          "transactions_user_type_idx",
          "users_pkey",
          "users_username_unique",
        ]),
      );
    } finally {
      await pool.end();
    }
  });

  it("seeds the demo user and fixed category set", async () => {
    await seedTestDatabase();

    const { pool, database, demoUser } = await getSeededContext();

    try {
      expect(demoUser.passwordHash).not.toBe(demoPassword);
      await expect(bcrypt.compare(demoPassword, demoUser.passwordHash)).resolves.toBe(true);

      const categoryRows = await database
        .select({
          slug: categories.slug,
          name: categories.name,
          type: categories.type,
        })
        .from(categories)
        .orderBy(categories.slug);

      expect(categoryRows).toEqual(
        [...seedCategories]
          .sort((left, right) => left.slug.localeCompare(right.slug))
          .map(({ slug, name, type }) => ({ slug, name, type })),
      );
    } finally {
      await pool.end();
    }
  });

  it("keeps seeding repeatable without duplicating users or categories", async () => {
    await seedTestDatabase();
    await seedTestDatabase();

    const { pool, database } = await getSeededContext();

    try {
      const [userCount] = await database.select({ value: count() }).from(users);
      const [categoryCount] = await database.select({ value: count() }).from(categories);

      expect(userCount?.value).toBe(1);
      expect(categoryCount?.value).toBe(seedCategories.length);
    } finally {
      await pool.end();
    }
  });

  it("enforces external_ref uniqueness only when present", async () => {
    await seedTestDatabase();

    const { pool, database, demoUser, categoryBySlug } = await getSeededContext();
    const foodCategory = categoryBySlug.get("food");

    if (!foodCategory) {
      throw new Error("Expected the seeded food category to exist.");
    }

    try {
      await database.insert(users).values({
        username: "second-user",
        passwordHash: "placeholder-hash",
      });

      const [secondUser] = await database
        .select()
        .from(users)
        .where(eq(users.username, "second-user"))
        .limit(1);

      if (!secondUser) {
        throw new Error("Expected the second test user to exist.");
      }

      await database.insert(transactions).values([
        {
          userId: demoUser.id,
          type: "expense",
          amountCents: 1000,
          currency: "HKD",
          categoryId: foodCategory.id,
          transactionDate: "2026-03-20",
          source: "manual",
          externalRef: null,
        },
        {
          userId: demoUser.id,
          type: "expense",
          amountCents: 2000,
          currency: "HKD",
          categoryId: foodCategory.id,
          transactionDate: "2026-03-21",
          source: "manual",
          externalRef: null,
        },
        {
          userId: demoUser.id,
          type: "expense",
          amountCents: 3000,
          currency: "HKD",
          categoryId: foodCategory.id,
          transactionDate: "2026-03-22",
          source: "manual",
          externalRef: "shared-ref",
        },
        {
          userId: secondUser.id,
          type: "expense",
          amountCents: 4000,
          currency: "HKD",
          categoryId: foodCategory.id,
          transactionDate: "2026-03-23",
          source: "manual",
          externalRef: "shared-ref",
        },
      ]);

      await expect(
        database.insert(transactions).values({
          userId: demoUser.id,
          type: "expense",
          amountCents: 5000,
          currency: "HKD",
          categoryId: foodCategory.id,
          transactionDate: "2026-03-24",
          source: "manual",
          externalRef: "shared-ref",
        }),
      ).rejects.toMatchObject({
        code: "23505",
      });
    } finally {
      await pool.end();
    }
  });

  it("calculates persisted summary values after create, update, and delete", async () => {
    await seedTestDatabase();

    const { pool, database, demoUser, categoryBySlug } = await getSeededContext();
    const salaryCategory = categoryBySlug.get("salary");
    const foodCategory = categoryBySlug.get("food");
    const billsCategory = categoryBySlug.get("bills");

    if (!salaryCategory || !foodCategory || !billsCategory) {
      throw new Error("Expected seeded categories for summary tests to exist.");
    }

    try {
      const [salaryTransaction] = await database
        .insert(transactions)
        .values([
          {
            userId: demoUser.id,
            type: "income",
            amountCents: 200_000,
            currency: "HKD",
            categoryId: salaryCategory.id,
            transactionDate: "2026-03-20",
            source: "manual",
            remarks: "March salary",
          },
          {
            userId: demoUser.id,
            type: "expense",
            amountCents: 45_500,
            currency: "HKD",
            categoryId: foodCategory.id,
            transactionDate: "2026-03-20",
            source: "manual",
            remarks: "Groceries",
          },
          {
            userId: demoUser.id,
            type: "expense",
            amountCents: 9_500,
            currency: "HKD",
            categoryId: billsCategory.id,
            transactionDate: "2026-03-21",
            source: "manual",
            remarks: "Utilities",
          },
        ])
        .returning({ id: transactions.id });

      expect(await getPersistedSummary(database, demoUser.id)).toEqual({
        totalIncomeCents: 200_000,
        totalExpenseCents: 55_000,
        balanceCents: 145_000,
        currency: "HKD",
      });

      await database
        .update(transactions)
        .set({
          amountCents: 15_000,
          updatedAt: new Date(),
        })
        .where(eq(transactions.remarks, "Utilities"));

      expect(await getPersistedSummary(database, demoUser.id)).toEqual({
        totalIncomeCents: 200_000,
        totalExpenseCents: 60_500,
        balanceCents: 139_500,
        currency: "HKD",
      });

      if (!salaryTransaction) {
        throw new Error("Expected a returned transaction identifier.");
      }

      await database.delete(transactions).where(eq(transactions.remarks, "Groceries"));

      expect(await getPersistedSummary(database, demoUser.id)).toEqual({
        totalIncomeCents: 200_000,
        totalExpenseCents: 15_000,
        balanceCents: 185_000,
        currency: "HKD",
      });
    } finally {
      await pool.end();
    }
  });
});
