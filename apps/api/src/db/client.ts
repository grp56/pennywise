import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { z } from "zod";

import * as schema from "./schema.js";

const databaseUrlSchema = z.string().min(1, "Database URL is required");

export type ApiDatabase = NodePgDatabase<typeof schema>;

export function getRequiredConnectionString(value: string | undefined, label: string): string {
  return databaseUrlSchema.parse(value, {
    path: [label],
  });
}

export function createPool(connectionString: string, extraConfig?: Partial<PoolConfig>): Pool {
  return new Pool({
    connectionString,
    ...extraConfig,
  });
}

export function createDatabase(pool: Pool): ApiDatabase {
  return drizzle(pool, { schema });
}

export async function withPool<T>(
  connectionString: string,
  callback: (pool: Pool) => Promise<T>,
): Promise<T> {
  const pool = createPool(connectionString);

  try {
    return await callback(pool);
  } finally {
    await pool.end();
  }
}

export async function withDatabase<T>(
  connectionString: string,
  callback: (database: ApiDatabase, pool: Pool) => Promise<T>,
): Promise<T> {
  return withPool(connectionString, async (pool) => {
    const database = createDatabase(pool);

    return callback(database, pool);
  });
}
