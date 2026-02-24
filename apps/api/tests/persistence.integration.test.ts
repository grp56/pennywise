import { describe, expect, it } from "vitest";

import { getRequiredConnectionString } from "../src/db/client.js";
import { categories, transactions, users } from "../src/db/schema.js";

describe("database client and schema smoke", () => {
  it("returns a provided connection string and rejects a missing one", () => {
    expect(getRequiredConnectionString("postgres://example", "DATABASE_URL")).toBe(
      "postgres://example",
    );
    expect(() => getRequiredConnectionString(undefined, "DATABASE_URL")).toThrow(
      "DATABASE_URL must be configured",
    );
  });

  it("exposes the expected schema columns", () => {
    expect(users).toHaveProperty("username");
    expect(users).toHaveProperty("passwordHash");
    expect(categories).toHaveProperty("slug");
    expect(categories).toHaveProperty("type");
    expect(transactions).toHaveProperty("amountCents");
    expect(transactions).toHaveProperty("transactionDate");
  });
});
