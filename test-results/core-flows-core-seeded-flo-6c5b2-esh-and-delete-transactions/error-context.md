# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core-flows.spec.ts >> core seeded flows >> seeded user can log in, create, edit, filter, refresh, and delete transactions
- Location: apps/web/e2e/core-flows.spec.ts:46:3

# Error details

```
Error: Unable to connect to TEST_DATABASE_URL (postgresql://pennywise:pennywise@localhost:5432/pennywise_test). Start the local test database and verify the connection string before running DB-backed tests. Original error: 
```

# Test source

```ts
  1   | import "../src/env.js";
  2   | 
  3   | import { eq } from "drizzle-orm";
  4   | import type { ApiConfig } from "../src/config.js";
  5   | 
  6   | import { createDatabase, createPool, getRequiredConnectionString } from "../src/db/client.js";
  7   | import { migrateDatabase } from "../src/db/migrate.js";
  8   | import { categories, users } from "../src/db/schema.js";
  9   | import { seedDatabase } from "../src/db/seed.js";
  10  | 
  11  | export const testDatabaseUrl = getRequiredConnectionString(
  12  |   process.env.TEST_DATABASE_URL,
  13  |   "TEST_DATABASE_URL",
  14  | );
  15  | export const demoUsername = process.env.DEMO_USERNAME ?? "demo";
  16  | export const demoPassword = process.env.DEMO_PASSWORD ?? "demo-password";
  17  | export const testSessionSecret = process.env.SESSION_SECRET ?? "test-session-secret";
  18  | 
  19  | export function createTestApiConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  20  |   return {
  21  |     connectionString: testDatabaseUrl,
  22  |     nodeEnv: "test",
  23  |     port: 0,
  24  |     sessionSecret: testSessionSecret,
  25  |     ...overrides,
  26  |   };
  27  | }
  28  | 
  29  | export async function ensureTestDatabaseAvailable(
  30  |   connectionString = testDatabaseUrl,
  31  | ): Promise<void> {
  32  |   const pool = createPool(connectionString);
  33  | 
  34  |   try {
  35  |     await pool.query("select 1");
  36  |   } catch (error) {
  37  |     const message = error instanceof Error ? error.message : String(error);
  38  | 
> 39  |     throw new Error(
      |           ^ Error: Unable to connect to TEST_DATABASE_URL (postgresql://pennywise:pennywise@localhost:5432/pennywise_test). Start the local test database and verify the connection string before running DB-backed tests. Original error: 
  40  |       `Unable to connect to TEST_DATABASE_URL (${connectionString}). Start the local test database and verify the connection string before running DB-backed tests. Original error: ${message}`,
  41  |       {
  42  |         cause: error,
  43  |       },
  44  |     );
  45  |   } finally {
  46  |     await pool.end();
  47  |   }
  48  | }
  49  | 
  50  | export async function resetTestDatabase(connectionString = testDatabaseUrl): Promise<void> {
  51  |   await ensureTestDatabaseAvailable(connectionString);
  52  | 
  53  |   const pool = createPool(connectionString);
  54  | 
  55  |   try {
  56  |     await pool.query("drop schema if exists public cascade");
  57  |     await pool.query("create schema public");
  58  |     await pool.query("grant all on schema public to public");
  59  |   } finally {
  60  |     await pool.end();
  61  |   }
  62  | }
  63  | 
  64  | export async function seedTestDatabase(connectionString = testDatabaseUrl): Promise<void> {
  65  |   await seedDatabase({
  66  |     connectionString,
  67  |     demoUsername,
  68  |     demoPassword,
  69  |   });
  70  | }
  71  | 
  72  | export async function prepareSeededTestDatabase(connectionString = testDatabaseUrl): Promise<void> {
  73  |   await resetTestDatabase(connectionString);
  74  |   await migrateDatabase(connectionString);
  75  |   await seedTestDatabase(connectionString);
  76  | }
  77  | 
  78  | export async function getSeededContext(connectionString = testDatabaseUrl) {
  79  |   const pool = createPool(connectionString);
  80  |   const database = createDatabase(pool);
  81  | 
  82  |   const [demoUser] = await database
  83  |     .select()
  84  |     .from(users)
  85  |     .where(eq(users.username, demoUsername))
  86  |     .limit(1);
  87  | 
  88  |   const categoryRows = await database.select().from(categories);
  89  |   const categoryBySlug = new Map(categoryRows.map((category) => [category.slug, category]));
  90  | 
  91  |   if (!demoUser) {
  92  |     throw new Error("Expected seeded demo user to exist.");
  93  |   }
  94  | 
  95  |   return {
  96  |     pool,
  97  |     database,
  98  |     demoUser,
  99  |     categoryBySlug,
  100 |   };
  101 | }
  102 | 
```