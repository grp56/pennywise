import { describe, expect, it } from "vitest";

import {
  calculateSummary,
  dateOnlySchema,
  isCategoryTypeCompatible,
  positiveAmountCentsSchema,
  remarksSchema,
} from "../src/index.js";

describe("positiveAmountCentsSchema", () => {
  it("accepts positive integers", () => {
    expect(positiveAmountCentsSchema.safeParse(5500).success).toBe(true);
  });

  it("rejects zero, negative numbers, and decimals", () => {
    expect(positiveAmountCentsSchema.safeParse(0).success).toBe(false);
    expect(positiveAmountCentsSchema.safeParse(-10).success).toBe(false);
    expect(positiveAmountCentsSchema.safeParse(12.5).success).toBe(false);
  });
});

describe("remarksSchema", () => {
  it("accepts missing remarks and strings up to 280 characters", () => {
    expect(remarksSchema.safeParse(undefined).success).toBe(true);
    expect(remarksSchema.safeParse("a".repeat(280)).success).toBe(true);
  });

  it("rejects remarks longer than 280 characters", () => {
    expect(remarksSchema.safeParse("a".repeat(281)).success).toBe(false);
  });
});

describe("dateOnlySchema", () => {
  it("accepts valid date-only values", () => {
    expect(dateOnlySchema.safeParse("2026-03-20").success).toBe(true);
    expect(dateOnlySchema.safeParse("2024-02-29").success).toBe(true);
  });

  it("rejects malformed and impossible dates", () => {
    expect(dateOnlySchema.safeParse("2026-3-20").success).toBe(false);
    expect(dateOnlySchema.safeParse("2026-03-20T09:10:00.000Z").success).toBe(
      false,
    );
    expect(dateOnlySchema.safeParse("2026-02-29").success).toBe(false);
    expect(dateOnlySchema.safeParse("2026-13-01").success).toBe(false);
  });
});

describe("isCategoryTypeCompatible", () => {
  it("returns true for matching transaction and category types", () => {
    expect(isCategoryTypeCompatible("income", "income")).toBe(true);
    expect(isCategoryTypeCompatible("expense", "expense")).toBe(true);
  });

  it("returns false for mismatched transaction and category types", () => {
    expect(isCategoryTypeCompatible("income", "expense")).toBe(false);
    expect(isCategoryTypeCompatible("expense", "income")).toBe(false);
  });
});

describe("calculateSummary", () => {
  it("returns zeroed summary values for an empty record set", () => {
    expect(calculateSummary([])).toEqual({
      totalIncomeCents: 0,
      totalExpenseCents: 0,
      balanceCents: 0,
      currency: "HKD",
    });
  });

  it("sums income and expenses and computes balance", () => {
    expect(
      calculateSummary([
        { type: "income", amountCents: 200_000 },
        { type: "income", amountCents: 25_000 },
        { type: "expense", amountCents: 45_500 },
        { type: "expense", amountCents: 9_500 },
      ]),
    ).toEqual({
      totalIncomeCents: 225_000,
      totalExpenseCents: 55_000,
      balanceCents: 170_000,
      currency: "HKD",
    });
  });
});
