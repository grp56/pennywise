import type {
  ApiError,
  AuthSession,
  AuthUser,
  CategoriesResponse,
  Category,
  SummaryResponse,
  Transaction,
  TransactionListResponse,
} from "@pennywise/contracts";
import { vi } from "vitest";
import { type ApiClient, ApiClientError, apiClient } from "../lib/api";

type ApiMethodName = keyof ApiClient;
type ApiMethodReturn<K extends ApiMethodName> = Awaited<ReturnType<ApiClient[K]>>;
type ApiMethodImplementation<K extends ApiMethodName> = (
  ...args: Parameters<ApiClient[K]>
) => ReturnType<ApiClient[K]>;
type ApiMethodOverride<K extends ApiMethodName> =
  | ApiMethodImplementation<K>
  | ApiClientError
  | ApiMethodReturn<K>;

export type ApiMockOverrides = {
  [K in ApiMethodName]?: ApiMethodOverride<K>;
};

export type ApiMethodMock = ReturnType<typeof vi.fn>;
export type ApiMethodMocks = Record<ApiMethodName, ApiMethodMock>;

export const demoUser: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "demo",
};

export const demoSession: AuthSession = {
  user: demoUser,
};

export const categoriesFixture: CategoriesResponse = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    slug: "salary",
    name: "Salary",
    type: "income",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    slug: "food",
    name: "Food",
    type: "expense",
  },
];

export const summaryFixture: SummaryResponse = {
  totalIncomeCents: 250_000,
  totalExpenseCents: 42_500,
  balanceCents: 207_500,
  currency: "HKD",
};

export function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const incomeCategory = categoriesFixture[0];

  if (!incomeCategory) {
    throw new Error("Expected the default income category fixture to exist.");
  }

  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    userId: demoUser.id,
    type: incomeCategory.type,
    amountCents: 250_000,
    currency: "HKD",
    categoryId: incomeCategory.id,
    categorySlug: incomeCategory.slug,
    categoryName: incomeCategory.name,
    transactionDate: "2026-03-20",
    remarks: "March salary",
    source: "manual",
    externalRef: null,
    createdAt: "2026-03-20T09:00:00.000Z",
    updatedAt: "2026-03-20T09:00:00.000Z",
    ...overrides,
  };
}

export function buildTransactionListResponse(
  items: Transaction[] = [buildTransaction()],
  overrides: Partial<TransactionListResponse> = {},
): TransactionListResponse {
  const totalItems = overrides.totalItems ?? items.length;
  const pageSize = overrides.pageSize ?? 20;

  return {
    items,
    page: overrides.page ?? 1,
    pageSize,
    totalItems,
    totalPages: overrides.totalPages ?? (totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize)),
  };
}

export function createApiClientError(
  status: number,
  responseBody: ApiError | null,
  message = responseBody?.message ?? `Request failed with status ${status}`,
): ApiClientError {
  return new ApiClientError(message, status, responseBody);
}

export function createUnauthorizedError(
  message = "Authentication required",
  status = 401,
): ApiClientError {
  return createApiClientError(status, {
    code: "UNAUTHORIZED",
    message,
  });
}

export function createValidationError(
  fieldErrors: Record<string, string[]>,
  message = "Request body failed validation",
): ApiClientError {
  return createApiClientError(400, {
    code: "VALIDATION_ERROR",
    message,
    details: {
      fieldErrors,
    },
  });
}

function unexpectedApiClientCall(method: ApiMethodName): never {
  throw new Error(
    `Unexpected apiClient.${String(method)}() call in a component test. Configure it with mockApi().`,
  );
}

function ensureApiMethodMock(method: ApiMethodName): ApiMethodMock {
  const candidate = apiClient[method];

  if (vi.isMockFunction(candidate)) {
    return candidate as ApiMethodMock;
  }

  return vi.spyOn(apiClient, method) as unknown as ApiMethodMock;
}

function setApiMethodOverride(
  mock: ApiMethodMock,
  method: ApiMethodName,
  override?: ApiMockOverrides[ApiMethodName],
): void {
  if (override === undefined) {
    mock.mockImplementation((() => unexpectedApiClientCall(method)) as never);
    return;
  }

  if (override instanceof ApiClientError) {
    mock.mockRejectedValue(override as never);
    return;
  }

  if (typeof override === "function") {
    mock.mockImplementation(override as never);
    return;
  }

  mock.mockResolvedValue(override as never);
}

export function mockApi(overrides: ApiMockOverrides = {}): ApiMethodMocks {
  const methods: ApiMethodName[] = [
    "login",
    "logout",
    "getMe",
    "getCategories",
    "listTransactions",
    "getTransaction",
    "createTransaction",
    "updateTransaction",
    "deleteTransaction",
    "getSummary",
  ];

  return methods.reduce((mocks, method) => {
    const mock = ensureApiMethodMock(method);
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, method);
    const override = hasOverride ? overrides[method] : undefined;

    setApiMethodOverride(mock, method, override);
    mocks[method] = mock;
    return mocks;
  }, {} as ApiMethodMocks);
}

export function mockAuthenticatedApi(
  overrides: Omit<ApiMockOverrides, "getMe"> = {},
): ApiMethodMocks {
  return mockApi({
    getMe: demoSession,
    ...overrides,
  });
}

export function mockUnauthenticatedApi(
  overrides: Omit<ApiMockOverrides, "getMe"> = {},
): ApiMethodMocks {
  return mockApi({
    getMe: createUnauthorizedError(),
    ...overrides,
  });
}

export function getCategoryBySlug(slug: Category["slug"]): Category {
  const category = categoriesFixture.find((entry) => entry.slug === slug);

  if (!category) {
    throw new Error(`Expected the '${slug}' category fixture to exist.`);
  }

  return category;
}
