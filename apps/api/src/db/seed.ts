import "dotenv/config";

import { fileURLToPath } from "node:url";

import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createDatabase, createPool, getRequiredConnectionString } from "./client.js";
import { categories, users } from "./schema.js";
import { seedCategories } from "./seed-data.js";

const seedEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DEMO_USERNAME: z.string().min(1, "DEMO_USERNAME is required"),
  DEMO_PASSWORD: z.string().min(1, "DEMO_PASSWORD is required"),
});

const passwordSaltRounds = 10;

export async function seedDatabase(input: {
  connectionString: string;
  demoUsername: string;
  demoPassword: string;
}): Promise<void> {
  const pool = createPool(input.connectionString);
  const database = createDatabase(pool);

  try {
    const passwordHash = await bcrypt.hash(input.demoPassword, passwordSaltRounds);

    await database
      .insert(users)
      .values({
        username: input.demoUsername,
        passwordHash,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          passwordHash,
          updatedAt: new Date(),
        },
      });

    for (const category of seedCategories) {
      await database
        .insert(categories)
        .values({
          slug: category.slug,
          name: category.name,
          type: category.type,
          isSystem: true,
        })
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            name: category.name,
            type: category.type,
            isSystem: true,
          },
        });
    }

    const [demoUser] = await database
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.username, input.demoUsername))
      .limit(1);

    if (!demoUser) {
      throw new Error("Seed failed to create the demo user.");
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const environment = seedEnvironmentSchema.parse({
    DATABASE_URL: getRequiredConnectionString(process.env.DATABASE_URL, "DATABASE_URL"),
    DEMO_USERNAME: process.env.DEMO_USERNAME,
    DEMO_PASSWORD: process.env.DEMO_PASSWORD,
  });

  await seedDatabase({
    connectionString: environment.DATABASE_URL,
    demoUsername: environment.DEMO_USERNAME,
    demoPassword: environment.DEMO_PASSWORD,
  });

  console.log("Database seed completed successfully.");
}
