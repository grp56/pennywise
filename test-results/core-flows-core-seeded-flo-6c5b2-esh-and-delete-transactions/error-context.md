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
  1   | import path from "node:path";
  2   | import { fileURLToPath } from "node:url";
  3   | 
  4   | import "../src/env.js";
  5   | 
  6   | import { eq } from "drizzle-orm";
  7   | import type { ApiConfig } from "../src/config.js";
  8   | 
  9   | import { createDatabase, createPool, getRequiredConnectionString } from "../src/db/client.js";
  10  | import { migrateDatabase } from "../src/db/migrate.js";
  11  | import { categories, users } from "../src/db/schema.js";
  12  | import { seedDatabase } from "../src/db/seed.js";
  13  | 
  14  | export const testDatabaseUrl = getRequiredConnectionString(
  15  |   process.env.TEST_DATABASE_URL,
  16  |   "TEST_DATABASE_URL",
  17  | );
  18  | export const demoUsername = process.env.DEMO_USERNAME ?? "demo";
  19  | export const demoPassword = process.env.DEMO_PASSWORD ?? "demo-password";
  20  | export const testSessionSecret = process.env.SESSION_SECRET ?? "test-session-secret";
  21  | 
  22  | const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  23  | const testFrontendDistPath = path.resolve(currentDirectory, "..", "..", "web", "dist");
  24  | 
  25  | export function createTestApiConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  26  |   return {
  27  |     connectionString: testDatabaseUrl,
  28  |     frontendDistPath: testFrontendDistPath,
  29  |     nodeEnv: "test",
  30  |     port: 0,
  31  |     sessionSecret: testSessionSecret,
  32  |     serveFrontendAssets: false,
  33  |     ...overrides,
  34  |   };
  35  | }
  36  | 
  37  | export async function ensureTestDatabaseAvailable(
  38  |   connectionString = testDatabaseUrl,
  39  | ): Promise<void> {
  40  |   const pool = createPool(connectionString);
  41  | 
  42  |   try {
  43  |     await pool.query("select 1");
  44  |   } catch (error) {
  45  |     const message = error instanceof Error ? error.message : String(error);
  46  | 
> 47  |     throw new Error(
      |           ^ Error: Unable to connect to TEST_DATABASE_URL (postgresql://pennywise:pennywise@localhost:5432/pennywise_test). Start the local test database and verify the connection string before running DB-backed tests. Original error: 
  48  |       `Unable to connect to TEST_DATABASE_URL (${connectionString}). Start the local test database and verify the connection string before running DB-backed tests. Original error: ${message}`,
  49  |       {
  50  |         cause: error,
  51  |       },
  52  |     );
  53  |   } finally {
  54  |     await pool.end();
  55  |   }
  56  | }
  57  | 
  58  | export async function resetTestDatabase(connectionString = testDatabaseUrl): Promise<void> {
  59  |   await ensureTestDatabaseAvailable(connectionString);
  60  | 
  61  |   const pool = createPool(connectionString);
  62  | 
  63  |   try {
  64  |     await pool.query("drop schema if exists public cascade");
  65  |     await pool.query("create schema public");
  66  |     await pool.query("grant all on schema public to public");
  67  |   } finally {
  68  |     await pool.end();
  69  |   }
  70  | }
  71  | 
  72  | export async function seedTestDatabase(connectionString = testDatabaseUrl): Promise<void> {
  73  |   await seedDatabase({
  74  |     connectionString,
  75  |     demoUsername,
  76  |     demoPassword,
  77  |   });
  78  | }
  79  | 
  80  | export async function prepareSeededTestDatabase(connectionString = testDatabaseUrl): Promise<void> {
  81  |   await resetTestDatabase(connectionString);
  82  |   await migrateDatabase(connectionString);
  83  |   await seedTestDatabase(connectionString);
  84  | }
  85  | 
  86  | export async function getSeededContext(connectionString = testDatabaseUrl) {
  87  |   const pool = createPool(connectionString);
  88  |   const database = createDatabase(pool);
  89  | 
  90  |   const [demoUser] = await database
  91  |     .select()
  92  |     .from(users)
  93  |     .where(eq(users.username, demoUsername))
  94  |     .limit(1);
  95  | 
  96  |   const categoryRows = await database.select().from(categories);
  97  |   const categoryBySlug = new Map(categoryRows.map((category) => [category.slug, category]));
  98  | 
  99  |   if (!demoUser) {
  100 |     throw new Error("Expected seeded demo user to exist.");
  101 |   }
  102 | 
  103 |   return {
  104 |     pool,
  105 |     database,
  106 |     demoUser,
  107 |     categoryBySlug,
  108 |   };
  109 | }
  110 | 
```