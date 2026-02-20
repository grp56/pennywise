import { z } from "zod";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const normalizedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    normalizedDate.getUTCFullYear() === year &&
    normalizedDate.getUTCMonth() === month - 1 &&
    normalizedDate.getUTCDate() === day &&
    normalizedDate.toISOString().slice(0, 10) === value
  );
}

function coerceOptionalInteger(value: unknown): unknown {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (trimmedValue === "") {
      return undefined;
    }

    return Number(trimmedValue);
  }

  return value;
}

const uuidSchema = z.string().uuid();
const isoTimestampSchema = z.string().datetime({ offset: true });

export const transactionTypeSchema = z.enum(["income", "expense"]);
export const transactionSourceSchema = z.enum(["manual", "mock_import"]);
export const currencySchema = z.literal("HKD");
export const apiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "INTERNAL_ERROR",
]);

export const positiveAmountCentsSchema = z
  .number()
  .int("Amount must be a whole number of cents")
  .positive("Amount must be greater than zero");

export const remarksSchema = z
  .string()
  .max(280, "Remarks must be 280 characters or fewer")
  .optional();

export const dateOnlySchema = z
  .string()
  .refine(isRealDateOnly, "Date must be a valid YYYY-MM-DD value");

export const loginRequestSchema = z
  .object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export const authUserSchema = z
  .object({
    id: uuidSchema,
    username: z.string().min(1, "Username is required"),
  })
  .strict();

export const authSessionSchema = z
  .object({
    user: authUserSchema,
  })
  .strict();

export const categorySchema = z
  .object({
    id: uuidSchema,
    slug: z.string().min(1, "Category slug is required"),
    name: z.string().min(1, "Category name is required"),
    type: transactionTypeSchema,
  })
  .strict();

export const categoriesResponseSchema = z.array(categorySchema);

export const createTransactionInputSchema = z
  .object({
    type: transactionTypeSchema,
    amountCents: positiveAmountCentsSchema,
    categoryId: uuidSchema,
    transactionDate: dateOnlySchema,
    remarks: remarksSchema,
  })
  .strict();

export const updateTransactionInputSchema = createTransactionInputSchema;

export const transactionSchema = z
  .object({
    id: uuidSchema,
    userId: uuidSchema,
    type: transactionTypeSchema,
    amountCents: positiveAmountCentsSchema,
    currency: currencySchema,
    categoryId: uuidSchema,
    categorySlug: z.string().min(1, "Category slug is required"),
    categoryName: z.string().min(1, "Category name is required"),
    transactionDate: dateOnlySchema,
    remarks: z
      .string()
      .max(280, "Remarks must be 280 characters or fewer")
      .nullable(),
    source: transactionSourceSchema,
    externalRef: z.string().min(1, "External reference cannot be empty").nullable(),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .strict();

const paginationQueryValueSchema = z.preprocess(
  coerceOptionalInteger,
  z.number().int().min(1).optional(),
);

export const transactionListQuerySchema = z
  .object({
    type: transactionTypeSchema.optional(),
    categoryId: uuidSchema.optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    page: paginationQueryValueSchema,
    pageSize: z.preprocess(
      coerceOptionalInteger,
      z.number().int().min(1).max(100).optional(),
    ),
  })
  .strict();

export const transactionListResponseSchema = z
  .object({
    items: z.array(transactionSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();

export const summaryResponseSchema = z
  .object({
    totalIncomeCents: z.number().int().min(0),
    totalExpenseCents: z.number().int().min(0),
    balanceCents: z.number().int(),
    currency: currencySchema,
  })
  .strict();

export const apiErrorSchema = z
  .object({
    code: apiErrorCodeSchema,
    message: z.string().min(1, "Error message is required"),
    details: z.record(z.unknown()).optional(),
  })
  .strict();

export const summaryCalculationRecordSchema = z
  .object({
    type: transactionTypeSchema,
    amountCents: positiveAmountCentsSchema,
  })
  .strict();

export function isCategoryTypeCompatible(
  categoryType: TransactionType,
  transactionType: TransactionType,
): boolean {
  return categoryType === transactionType;
}

export function calculateSummary(
  records: ReadonlyArray<SummaryCalculationRecord>,
): SummaryResponse {
  const totals = records.reduce(
    (result, record) => {
      if (record.type === "income") {
        result.totalIncomeCents += record.amountCents;
      } else {
        result.totalExpenseCents += record.amountCents;
      }

      return result;
    },
    {
      totalIncomeCents: 0,
      totalExpenseCents: 0,
    },
  );

  return {
    ...totals,
    balanceCents: totals.totalIncomeCents - totals.totalExpenseCents,
    currency: "HKD",
  };
}

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionSource = z.infer<typeof transactionSourceSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type Category = z.infer<typeof categorySchema>;
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionInputSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
export type TransactionListResponse = z.infer<typeof transactionListResponseSchema>;
export type SummaryResponse = z.infer<typeof summaryResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type SummaryCalculationRecord = z.infer<
  typeof summaryCalculationRecordSchema
>;
