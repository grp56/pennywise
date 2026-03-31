import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buildTransaction,
  buildTransactionListResponse,
  categoriesFixture,
  getCategoryBySlug,
  mockAuthenticatedApi,
} from "../test/mockApi";
import { renderApp } from "../test/renderApp";

function buildExpectedQuery(
  overrides: Partial<{
    categoryId: string | undefined;
    from: string | undefined;
    page: number;
    pageSize: 20;
    to: string | undefined;
    type: "income" | "expense" | undefined;
  }> = {},
) {
  return {
    type: undefined,
    categoryId: undefined,
    from: undefined,
    to: undefined,
    page: 1,
    pageSize: 20 as const,
    ...overrides,
  };
}

function getHistoryRow(content: string | RegExp): HTMLElement {
  const match = screen.getByText(content);
  const row = match.closest("article");

  if (!row) {
    throw new Error(`Expected '${String(content)}' to appear inside a transaction history row.`);
  }

  return row;
}

describe("TransactionsPage", () => {
  it("shows the empty filtered history state when no transactions match", async () => {
    const mocks = mockAuthenticatedApi();
    mocks.getCategories.mockResolvedValue(categoriesFixture);
    mocks.listTransactions.mockResolvedValue(
      buildTransactionListResponse([], {
        totalItems: 0,
        totalPages: 0,
      }),
    );

    renderApp({ route: "/transactions?type=expense" });

    expect(await screen.findByText("Nothing matches the current filters")).toBeInTheDocument();
    expect(screen.getByText("No matching transactions")).toBeInTheDocument();
    expect(mocks.listTransactions).toHaveBeenCalledWith(
      buildExpectedQuery({
        type: "expense",
      }),
    );
  });

  it("reloads history when the filters change and resets pagination back to page 1", async () => {
    const foodCategory = getCategoryBySlug("food");
    const incomeTransaction = buildTransaction({
      remarks: "Income baseline",
    });
    const expenseTransaction = buildTransaction({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      type: foodCategory.type,
      amountCents: 4_250,
      categoryId: foodCategory.id,
      categorySlug: foodCategory.slug,
      categoryName: foodCategory.name,
      remarks: "Filtered expense",
    });
    const mocks = mockAuthenticatedApi();
    mocks.getCategories.mockResolvedValue(categoriesFixture);
    mocks.listTransactions.mockImplementation(async (query = buildExpectedQuery()) => {
      if (query.type === "expense" && query.categoryId === foodCategory.id) {
        return buildTransactionListResponse([expenseTransaction], {
          page: query.page ?? 1,
          totalItems: 1,
          totalPages: 1,
        });
      }

      if (query.type === "expense") {
        return buildTransactionListResponse([expenseTransaction], {
          page: query.page ?? 1,
          totalItems: 1,
          totalPages: 1,
        });
      }

      return buildTransactionListResponse([incomeTransaction, expenseTransaction], {
        page: query.page ?? 1,
        totalItems: 42,
        totalPages: 3,
      });
    });

    const { user } = renderApp({ route: "/transactions?page=2" });

    expect(await screen.findByText("Newest first")).toBeInTheDocument();
    expect(mocks.listTransactions).toHaveBeenNthCalledWith(
      1,
      buildExpectedQuery({
        page: 2,
      }),
    );

    await user.selectOptions(screen.getByLabelText("Type"), "expense");

    await waitFor(() => {
      expect(mocks.listTransactions).toHaveBeenLastCalledWith(
        buildExpectedQuery({
          type: "expense",
        }),
      );
    });

    await user.selectOptions(screen.getByLabelText("Category"), foodCategory.id);

    await waitFor(() => {
      expect(mocks.listTransactions).toHaveBeenLastCalledWith(
        buildExpectedQuery({
          type: "expense",
          categoryId: foodCategory.id,
        }),
      );
    });

    expect(screen.getByLabelText("Type")).toHaveValue("expense");
    expect(screen.getByLabelText("Category")).toHaveValue(foodCategory.id);
    expect(screen.getByText(/Filtered expense/)).toBeInTheDocument();
  });

  it("moves between pages and reloads the corresponding transaction set", async () => {
    const pageOneTransaction = buildTransaction({
      remarks: "Page one salary",
    });
    const pageTwoTransaction = buildTransaction({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      remarks: "Page two salary",
    });
    const mocks = mockAuthenticatedApi();
    mocks.getCategories.mockResolvedValue(categoriesFixture);
    mocks.listTransactions.mockImplementation(async (query = buildExpectedQuery()) => {
      if (query.page === 2) {
        return buildTransactionListResponse([pageTwoTransaction], {
          page: 2,
          totalItems: 21,
          totalPages: 2,
        });
      }

      return buildTransactionListResponse([pageOneTransaction], {
        page: 1,
        totalItems: 21,
        totalPages: 2,
      });
    });

    const { user } = renderApp({ route: "/transactions" });

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByText(/Page one salary/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText(/Page two salary/)).toBeInTheDocument();
    expect(mocks.listTransactions).toHaveBeenNthCalledWith(
      2,
      buildExpectedQuery({
        page: 2,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Previous" }));

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    expect(mocks.listTransactions).toHaveBeenNthCalledWith(3, buildExpectedQuery());
  });

  it("does not delete a transaction when the confirmation dialog is cancelled", async () => {
    const transaction = buildTransaction({
      remarks: "Keep this transaction",
    });
    const mocks = mockAuthenticatedApi();
    mocks.getCategories.mockResolvedValue(categoriesFixture);
    mocks.listTransactions.mockResolvedValue(buildTransactionListResponse([transaction]));
    vi.mocked(window.confirm).mockReturnValue(false);

    const { user } = renderApp({ route: "/transactions" });

    expect(await screen.findByText(/Keep this transaction/)).toBeInTheDocument();

    await user.click(
      within(getHistoryRow(/Keep this transaction/)).getByRole("button", { name: "Delete" }),
    );

    expect(window.confirm).toHaveBeenCalledWith("Delete this transaction?");
    expect(mocks.deleteTransaction).not.toHaveBeenCalled();
    expect(mocks.listTransactions).toHaveBeenCalledTimes(1);
  });

  it("refreshes the current page after a successful delete", async () => {
    const transactionToDelete = buildTransaction({
      remarks: "Delete this transaction",
    });
    const remainingTransaction = buildTransaction({
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      remarks: "Remaining transaction",
    });
    const mocks = mockAuthenticatedApi();
    mocks.getCategories.mockResolvedValue(categoriesFixture);
    mocks.listTransactions
      .mockResolvedValueOnce(
        buildTransactionListResponse([transactionToDelete, remainingTransaction]),
      )
      .mockResolvedValueOnce(buildTransactionListResponse([remainingTransaction]));
    mocks.deleteTransaction.mockResolvedValue(undefined);

    const { user } = renderApp({ route: "/transactions" });

    expect(await screen.findByText(/Delete this transaction/)).toBeInTheDocument();

    await user.click(
      within(getHistoryRow(/Delete this transaction/)).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => {
      expect(mocks.deleteTransaction).toHaveBeenCalledWith(transactionToDelete.id);
    });

    expect(await screen.findByText(/Remaining transaction/)).toBeInTheDocument();
    expect(screen.queryByText(/Delete this transaction/)).not.toBeInTheDocument();
    expect(mocks.listTransactions).toHaveBeenNthCalledWith(2, buildExpectedQuery());
  });

  it("returns to the previous page after deleting the last transaction on a later page", async () => {
    const pageTwoTransaction = buildTransaction({
      id: "12121212-1212-4121-8121-121212121212",
      remarks: "Only item on page two",
    });
    const pageOneTransaction = buildTransaction({
      id: "34343434-3434-4343-8343-343434343434",
      remarks: "Still visible on page one",
    });
    const mocks = mockAuthenticatedApi();
    mocks.getCategories.mockResolvedValue(categoriesFixture);
    mocks.listTransactions
      .mockResolvedValueOnce(
        buildTransactionListResponse([pageTwoTransaction], {
          page: 2,
          totalItems: 21,
          totalPages: 2,
        }),
      )
      .mockResolvedValueOnce(
        buildTransactionListResponse([], {
          page: 2,
          totalItems: 20,
          totalPages: 1,
        }),
      )
      .mockResolvedValueOnce(
        buildTransactionListResponse([pageOneTransaction], {
          page: 1,
          totalItems: 20,
          totalPages: 1,
        }),
      );
    mocks.deleteTransaction.mockResolvedValue(undefined);

    const { user } = renderApp({ route: "/transactions?page=2" });

    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();

    await user.click(
      within(getHistoryRow(/Only item on page two/)).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => {
      expect(mocks.listTransactions).toHaveBeenNthCalledWith(3, buildExpectedQuery());
    });

    expect(await screen.findByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getByText(/Still visible on page one/)).toBeInTheDocument();
    expect(screen.queryByText(/Only item on page two/)).not.toBeInTheDocument();
  });
});
