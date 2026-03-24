import type {
  Category,
  TransactionListQuery,
  TransactionListResponse,
  TransactionType,
} from "@pennywise/contracts";
import { transactionListQuerySchema } from "@pennywise/contracts";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth";
import { apiClient, isApiClientError } from "../lib/api";
import { formatCurrencyFromCents, formatDateLabel } from "../lib/format";

interface TransactionsPageState {
  categories: Category[];
  listResponse: TransactionListResponse | null;
}

interface ParsedTransactionFilters {
  categoryId: string | undefined;
  from: string | undefined;
  page: number;
  pageSize: 20;
  to: string | undefined;
  type: TransactionType | undefined;
}

interface ParsedTransactionQuery {
  errorMessage: string | null;
  query: ParsedTransactionFilters;
}

function parseTransactionQuery(searchParams: URLSearchParams): ParsedTransactionQuery {
  const rawQuery = Object.fromEntries(searchParams.entries());
  const parsed = transactionListQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return {
      errorMessage: parsed.error.issues[0]?.message ?? "Invalid filters provided.",
      query: {
        type: undefined,
        categoryId: undefined,
        from: undefined,
        to: undefined,
        page: 1,
        pageSize: 20,
      },
    };
  }

  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    return {
      errorMessage: "Start date must be on or before end date.",
      query: {
        type: parsed.data.type,
        categoryId: parsed.data.categoryId,
        from: parsed.data.from,
        to: parsed.data.to,
        page: parsed.data.page ?? 1,
        pageSize: 20,
      },
    };
  }

  return {
    errorMessage: null,
    query: {
      type: parsed.data.type,
      categoryId: parsed.data.categoryId,
      from: parsed.data.from,
      to: parsed.data.to,
      page: parsed.data.page ?? 1,
      pageSize: 20,
    },
  };
}

function buildSearchParams(query: ParsedTransactionQuery["query"]): URLSearchParams {
  const params = new URLSearchParams();

  if (query.type) {
    params.set("type", query.type);
  }

  if (query.categoryId) {
    params.set("categoryId", query.categoryId);
  }

  if (query.from) {
    params.set("from", query.from);
  }

  if (query.to) {
    params.set("to", query.to);
  }

  if (query.page > 1) {
    params.set("page", String(query.page));
  }

  return params;
}

export function TransactionsPage() {
  const { markSessionExpired } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedQuery = useMemo(() => parseTransactionQuery(searchParams), [searchParams]);
  const [state, setState] = useState<TransactionsPageState>({
    categories: [],
    listResponse: null,
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadTransactions() {
      if (parsedQuery.errorMessage) {
        setLoading(false);
        setErrorMessage(parsedQuery.errorMessage);
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        const [categories, listResponse] = await Promise.all([
          apiClient.getCategories(),
          apiClient.listTransactions(parsedQuery.query),
        ]);

        if (ignore) {
          return;
        }

        setState({
          categories,
          listResponse,
        });
      } catch (error) {
        if (ignore) {
          return;
        }

        if (isApiClientError(error) && error.status === 401) {
          markSessionExpired();
          return;
        }

        console.error(error);
        setErrorMessage("Transaction history could not be loaded.");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadTransactions();

    return () => {
      ignore = true;
    };
  }, [markSessionExpired, parsedQuery]);

  const filteredCategories = useMemo(() => {
    if (!parsedQuery.query.type) {
      return state.categories;
    }

    return state.categories.filter((category) => category.type === parsedQuery.query.type);
  }, [parsedQuery.query.type, state.categories]);

  function updateFilters(
    patch: Partial<ParsedTransactionQuery["query"]>,
    options: { resetPage?: boolean } = {},
  ) {
    const nextQuery = {
      ...parsedQuery.query,
      ...patch,
      page: options.resetPage ? 1 : (patch.page ?? parsedQuery.query.page),
    };

    if (nextQuery.type && nextQuery.categoryId) {
      const selectedCategory = state.categories.find(
        (category) => category.id === nextQuery.categoryId,
      );

      if (selectedCategory && selectedCategory.type !== nextQuery.type) {
        nextQuery.categoryId = undefined;
      }
    }

    setSearchParams(buildSearchParams(nextQuery));
  }

  async function handleDelete(transactionId: string) {
    const confirmed = window.confirm("Delete this transaction?");

    if (!confirmed) {
      return;
    }

    setDeletingId(transactionId);

    try {
      await apiClient.deleteTransaction(transactionId);
      const refreshed = await apiClient.listTransactions(parsedQuery.query);

      if (refreshed.items.length === 0 && parsedQuery.query.page > 1) {
        updateFilters(
          {
            page: parsedQuery.query.page - 1,
          },
          {
            resetPage: false,
          },
        );
        return;
      }

      setState((current) => ({
        ...current,
        listResponse: refreshed,
      }));
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        markSessionExpired();
        return;
      }

      console.error(error);
      setErrorMessage("The transaction could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="content-grid">
      <section className="page-header">
        <div>
          <p className="section-eyebrow">Transaction History</p>
          <h2 className="panel-title panel-title--hero">Income and expense flow</h2>
          <p className="muted-text">
            Filter by type, category, and date range while keeping the API query in the URL.
          </p>
        </div>

        <Link className="button-primary" to="/transactions/new">
          <span className="material-symbols-outlined" aria-hidden="true">
            add
          </span>
          <span>Add Transaction</span>
        </Link>
      </section>

      <section className="filter-grid">
        <label className="filter-card">
          <span className="field__label">Type</span>
          <select
            className="field__control"
            value={parsedQuery.query.type ?? ""}
            onChange={(event) =>
              updateFilters(
                {
                  type:
                    event.target.value === "" ? undefined : (event.target.value as TransactionType),
                },
                {
                  resetPage: true,
                },
              )
            }
          >
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>

        <label className="filter-card">
          <span className="field__label">Category</span>
          <select
            className="field__control"
            value={parsedQuery.query.categoryId ?? ""}
            onChange={(event) =>
              updateFilters(
                {
                  categoryId: event.target.value === "" ? undefined : event.target.value,
                },
                {
                  resetPage: true,
                },
              )
            }
          >
            <option value="">All categories</option>
            {filteredCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-card">
          <span className="field__label">From</span>
          <input
            className="field__control"
            type="date"
            value={parsedQuery.query.from ?? ""}
            onChange={(event) =>
              updateFilters(
                {
                  from: event.target.value === "" ? undefined : event.target.value,
                },
                {
                  resetPage: true,
                },
              )
            }
          />
        </label>

        <label className="filter-card">
          <span className="field__label">To</span>
          <input
            className="field__control"
            type="date"
            value={parsedQuery.query.to ?? ""}
            onChange={(event) =>
              updateFilters(
                {
                  to: event.target.value === "" ? undefined : event.target.value,
                },
                {
                  resetPage: true,
                },
              )
            }
          />
        </label>
      </section>

      {errorMessage ? (
        <section className="glass-panel empty-state">
          <h3 className="panel-title">History unavailable</h3>
          <p className="muted-text">{errorMessage}</p>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setSearchParams(new URLSearchParams())}
          >
            Reset filters
          </button>
        </section>
      ) : null}

      {loading ? (
        <section className="glass-panel empty-state">
          <h3 className="panel-title">Loading transactions</h3>
          <p className="muted-text">Fetching the latest persisted records.</p>
        </section>
      ) : null}

      {!loading && !errorMessage && state.listResponse ? (
        <section className="glass-panel history-panel">
          <div className="history-panel__header">
            <div>
              <p className="section-eyebrow">Records</p>
              <h3 className="panel-title">Newest first</h3>
            </div>
            <p className="muted-text">
              {state.listResponse.totalItems === 0
                ? "No matching transactions"
                : `${state.listResponse.totalItems} matching transaction${
                    state.listResponse.totalItems === 1 ? "" : "s"
                  }`}
            </p>
          </div>

          {state.listResponse.items.length === 0 ? (
            <div className="empty-state">
              <p className="panel-title">Nothing matches the current filters</p>
              <p className="muted-text">
                Clear one or more filters or create a new transaction to populate the history.
              </p>
            </div>
          ) : (
            <div className="history-list">
              {state.listResponse.items.map((transaction) => (
                <article key={transaction.id} className="history-row">
                  <div className="history-row__main">
                    <span
                      className={`pill ${
                        transaction.type === "income" ? "pill--income" : "pill--expense"
                      }`}
                    >
                      {transaction.type}
                    </span>
                    <div>
                      <h4 className="history-row__title">{transaction.categoryName}</h4>
                      <p className="history-row__subtitle">
                        {transaction.remarks || transaction.categorySlug} ·{" "}
                        {formatDateLabel(transaction.transactionDate)}
                      </p>
                    </div>
                  </div>

                  <p
                    className={
                      transaction.type === "income"
                        ? "amount amount--positive"
                        : "amount amount--negative"
                    }
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrencyFromCents(transaction.amountCents)}
                  </p>

                  <div className="history-row__actions">
                    <Link className="button-secondary" to={`/transactions/${transaction.id}/edit`}>
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => void handleDelete(transaction.id)}
                      disabled={deletingId === transaction.id}
                    >
                      {deletingId === transaction.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {state.listResponse.totalPages > 0 ? (
            <div className="pagination-row">
              <button
                type="button"
                className="button-secondary"
                disabled={parsedQuery.query.page <= 1}
                onClick={() =>
                  updateFilters(
                    {
                      page: parsedQuery.query.page - 1,
                    },
                    {
                      resetPage: false,
                    },
                  )
                }
              >
                Previous
              </button>
              <p className="muted-text">
                Page {state.listResponse.page} of {state.listResponse.totalPages}
              </p>
              <button
                type="button"
                className="button-secondary"
                disabled={parsedQuery.query.page >= state.listResponse.totalPages}
                onClick={() =>
                  updateFilters(
                    {
                      page: parsedQuery.query.page + 1,
                    },
                    {
                      resetPage: false,
                    },
                  )
                }
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
