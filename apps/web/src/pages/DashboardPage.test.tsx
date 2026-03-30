import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  buildTransaction,
  buildTransactionListResponse,
  getCategoryBySlug,
  mockAuthenticatedApi,
  summaryFixture,
} from "../test/mockApi";
import { renderApp } from "../test/renderApp";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

describe("DashboardPage", () => {
  it("shows the dashboard loading state while summary and recent activity are loading", async () => {
    const summaryRequest = createDeferred<typeof summaryFixture>();
    const recentActivityRequest = createDeferred<ReturnType<typeof buildTransactionListResponse>>();
    const mocks = mockAuthenticatedApi({
      getSummary: () => summaryRequest.promise,
      listTransactions: () => recentActivityRequest.promise,
    });

    renderApp({ route: "/dashboard" });

    expect(await screen.findByText("Loading...")).toBeInTheDocument();
    expect(screen.getByText("Retrieving summary and recent activity.")).toBeInTheDocument();
    expect(mocks.getSummary).toHaveBeenCalledTimes(1);
    expect(mocks.listTransactions).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
    });

    summaryRequest.resolve(summaryFixture);
    recentActivityRequest.resolve(buildTransactionListResponse());

    expect(await screen.findByText("Last 5 entries")).toBeInTheDocument();
  });

  it("renders summary totals and recent activity after the dashboard loads", async () => {
    const foodCategory = getCategoryBySlug("food");
    const incomeTransaction = buildTransaction();
    const expenseTransaction = buildTransaction({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      type: foodCategory.type,
      amountCents: 4_250,
      categoryId: foodCategory.id,
      categorySlug: foodCategory.slug,
      categoryName: foodCategory.name,
      transactionDate: "2026-03-19",
      remarks: "Team lunch",
    });
    const mocks = mockAuthenticatedApi({
      getSummary: summaryFixture,
      listTransactions: buildTransactionListResponse([incomeTransaction, expenseTransaction]),
    });

    renderApp({ route: "/dashboard" });

    expect(await screen.findByText("Last 5 entries")).toBeInTheDocument();
    expect(mocks.getSummary).toHaveBeenCalledTimes(1);
    expect(mocks.listTransactions).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
    });
    expect(screen.getByText("HK$2,075.00")).toBeInTheDocument();
    expect(screen.getByText("HK$2,500.00")).toBeInTheDocument();
    expect(screen.getByText("HK$425.00")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText(/March salary/)).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText(/Team lunch/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/transactions");
    expect(screen.getByRole("link", { name: "Record Entry" })).toHaveAttribute(
      "href",
      "/transactions/new",
    );
    expect(screen.getByRole("link", { name: "Open History" })).toHaveAttribute(
      "href",
      "/transactions",
    );
  });

  it("shows the empty recent-activity state when there are no transactions yet", async () => {
    mockAuthenticatedApi({
      getSummary: summaryFixture,
      listTransactions: buildTransactionListResponse([], {
        totalItems: 0,
        totalPages: 0,
      }),
    });

    renderApp({ route: "/dashboard" });

    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create the first income or expense record to populate the dashboard."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Add Transaction" }).some((link) => {
        return link.getAttribute("href") === "/transactions/new";
      }),
    ).toBe(true);
  });
});
