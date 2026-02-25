import "dotenv/config";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";

import { getRequiredConnectionString, withDatabase } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(__dirname, "../../drizzle");

export async function migrateDatabase(connectionString: string): Promise<void> {
  await withDatabase(connectionString, async (database, pool) => {
    await database.execute(sql`
      create table if not exists app_migrations (
        name text primary key,
        run_at timestamptz not null default now()
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));

    const appliedRows = await database.execute(sql`select name from app_migrations`);
    const appliedMigrations = new Set(
      appliedRows.rows
        .map((row) => row.name)
        .filter((name): name is string => typeof name === "string"),
    );

    for (const fileName of files) {
      if (appliedMigrations.has(fileName)) {
        continue;
      }

      const filePath = path.join(migrationsDirectory, fileName);
      const migrationSql = await readFile(filePath, "utf8");
      const client = await pool.connect();

      try {
        await client.query("begin");
        await client.query(migrationSql);
        await client.query("insert into app_migrations (name) values ($1)", [fileName]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const connectionString = getRequiredConnectionString(process.env.DATABASE_URL, "DATABASE_URL");

  await migrateDatabase(connectionString);
  console.log("Database migrations applied successfully.");
}
