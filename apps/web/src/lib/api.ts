import type {
  ApiError,
  AuthSession,
  CategoriesResponse,
  CreateTransactionInput,
  LoginRequest,
  SummaryResponse,
  Transaction,
  TransactionListQuery,
  TransactionListResponse,
  UpdateTransactionInput,
} from "@pennywise/contracts";
import {
  apiErrorSchema,
  authSessionSchema,
  categoriesResponseSchema,
  createTransactionInputSchema,
  loginRequestSchema,
  summaryResponseSchema,
  transactionListQuerySchema,
  transactionListResponseSchema,
  transactionSchema,
  updateTransactionInputSchema,
} from "@pennywise/contracts";

export class ApiClientError extends Error {
  readonly responseBody: ApiError | null;
  readonly status: number;

  constructor(message: string, status: number, responseBody: ApiError | null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function buildQueryString(query: TransactionListQuery): string {
  const parsed = transactionListQuerySchema.parse(query);
  const params = new URLSearchParams();

  if (parsed.type) {
    params.set("type", parsed.type);
  }

  if (parsed.categoryId) {
    params.set("categoryId", parsed.categoryId);
  }

  if (parsed.from) {
    params.set("from", parsed.from);
  }

  if (parsed.to) {
    params.set("to", parsed.to);
  }

  if (parsed.page) {
    params.set("page", String(parsed.page));
  }

  if (parsed.pageSize) {
    params.set("pageSize", String(parsed.pageSize));
  }

  const serialized = params.toString();

  return serialized === "" ? "" : `?${serialized}`;
}

async function parseErrorResponse(response: Response, bodyText: string): Promise<ApiClientError> {
  let responseBody: ApiError | null = null;

  if (bodyText !== "") {
    try {
      responseBody = apiErrorSchema.parse(JSON.parse(bodyText));
    } catch {
      responseBody = null;
    }
  }

  return new ApiClientError(
    responseBody?.message ?? `Request failed with status ${response.status}`,
    response.status,
    responseBody,
  );
}

async function request<T>(
  path: string,
  options: {
    body?: unknown;
    method?: string;
    responseSchema?: {
      parse: (value: unknown) => T;
    };
  } = {},
): Promise<T> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const requestInit: RequestInit = {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
  };

  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, requestInit);
  const responseText = await response.text();

  if (!response.ok) {
    throw await parseErrorResponse(response, responseText);
  }

  if (options.responseSchema === undefined || responseText === "") {
    return undefined as T;
  }

  return options.responseSchema.parse(JSON.parse(responseText));
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export interface ApiClient {
  createTransaction(input: CreateTransactionInput): Promise<Transaction>;
  deleteTransaction(transactionId: string): Promise<void>;
  getCategories(): Promise<CategoriesResponse>;
  getMe(): Promise<AuthSession>;
  getSummary(): Promise<SummaryResponse>;
  getTransaction(transactionId: string): Promise<Transaction>;
  listTransactions(query?: TransactionListQuery): Promise<TransactionListResponse>;
  login(input: LoginRequest): Promise<AuthSession>;
  logout(): Promise<void>;
  updateTransaction(transactionId: string, input: UpdateTransactionInput): Promise<Transaction>;
}

export const apiClient: ApiClient = {
  async login(input) {
    const payload = loginRequestSchema.parse(input);

    return request("/api/auth/login", {
      method: "POST",
      body: payload,
      responseSchema: authSessionSchema,
    });
  },

  async logout() {
    await request("/api/auth/logout", {
      method: "POST",
    });
  },

  async getMe() {
    return request("/api/me", {
      responseSchema: authSessionSchema,
    });
  },

  async getCategories() {
    return request("/api/categories", {
      responseSchema: categoriesResponseSchema,
    });
  },

  async listTransactions(query = {}) {
    return request(`/api/transactions${buildQueryString(query)}`, {
      responseSchema: transactionListResponseSchema,
    });
  },

  async getTransaction(transactionId) {
    return request(`/api/transactions/${transactionId}`, {
      responseSchema: transactionSchema,
    });
  },

  async createTransaction(input) {
    const payload = createTransactionInputSchema.parse(input);

    return request("/api/transactions", {
      method: "POST",
      body: payload,
      responseSchema: transactionSchema,
    });
  },

  async updateTransaction(transactionId, input) {
    const payload = updateTransactionInputSchema.parse(input);

    return request(`/api/transactions/${transactionId}`, {
      method: "PUT",
      body: payload,
      responseSchema: transactionSchema,
    });
  },

  async deleteTransaction(transactionId) {
    await request(`/api/transactions/${transactionId}`, {
      method: "DELETE",
    });
  },

  async getSummary() {
    return request("/api/summary", {
      responseSchema: summaryResponseSchema,
    });
  },
};

export function getValidationFieldErrors(
  error: ApiClientError,
): Record<string, string[]> | undefined {
  const details = error.responseBody?.details;

  if (!isRecord(details)) {
    return undefined;
  }

  const fieldErrors = details.fieldErrors;

  if (!isRecord(fieldErrors)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => {
      const value = entry[1];
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    }),
  );
}
