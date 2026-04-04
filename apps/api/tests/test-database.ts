import path from "node:path";
import { fileURLToPath } from "node:url";

import "../src/env.js";

import { eq } from "drizzle-orm";
import type { ApiConfig } from "../src/config.js";

import { createDatabase, createPool, getRequiredConnectionString } from "../src/db/client.js";
import { migrateDatabase } from "../src/db/migrate.js";
import { categories, users } from "../src/db/schema.js";
import { seedDatabase } from "../src/db/seed.js";

export const testDatabaseUrl = getRequiredConnectionString(
  process.env.TEST_DATABASE_URL,
  "TEST_DATABASE_URL",
);
export const demoUsername = process.env.DEMO_USERNAME ?? "demo";
export const demoPassword = process.env.DEMO_PASSWORD ?? "demo-password";
export const testSessionSecret = process.env.SESSION_SECRET ?? "test-session-secret";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const testFrontendDistPath = path.resolve(currentDirectory, "..", "..", "web", "dist");

export function createTestApiConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    connectionString: testDatabaseUrl,
    frontendDistPath: testFrontendDistPath,
    nodeEnv: "test",
    port: 0,
    sessionSecret: testSessionSecret,
    serveFrontendAssets: false,
    ...overrides,
  };
}

export async function ensureTestDatabaseAvailable(
  connectionString = testDatabaseUrl,
): Promise<void> {
  const pool = createPool(connectionString);

  try {
    await pool.query("select 1");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Unable to connect to TEST_DATABASE_URL (${connectionString}). Start the local test database and verify the connection string before running DB-backed tests. Original error: ${message}`,
      {
        cause: error,
      },
    );
  } finally {
    await pool.end();
  }
}

export async function resetTestDatabase(connectionString = testDatabaseUrl): Promise<void> {
  await ensureTestDatabaseAvailable(connectionString);

  const pool = createPool(connectionString);

  try {
    await pool.query("drop schema if exists public cascade");
    await pool.query("create schema public");
    await pool.query("grant all on schema public to public");
  } finally {
    await pool.end();
  }
}

export async function seedTestDatabase(connectionString = testDatabaseUrl): Promise<void> {
  await seedDatabase({
    connectionString,
    demoUsername,
    demoPassword,
  });
}

export async function prepareSeededTestDatabase(connectionString = testDatabaseUrl): Promise<void> {
  await resetTestDatabase(connectionString);
  await migrateDatabase(connectionString);
  await seedTestDatabase(connectionString);
}

export async function getSeededContext(connectionString = testDatabaseUrl) {
  const pool = createPool(connectionString);
  const database = createDatabase(pool);

  const [demoUser] = await database
    .select()
    .from(users)
    .where(eq(users.username, demoUsername))
    .limit(1);

  const categoryRows = await database.select().from(categories);
  const categoryBySlug = new Map(categoryRows.map((category) => [category.slug, category]));

  if (!demoUser) {
    throw new Error("Expected seeded demo user to exist.");
  }

  return {
    pool,
    database,
    demoUser,
    categoryBySlug,
  };
}
