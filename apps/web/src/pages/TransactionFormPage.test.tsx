import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  buildTransaction,
  buildTransactionListResponse,
  categoriesFixture,
  createValidationError,
  getCategoryBySlug,
  mockAuthenticatedApi,
} from "../test/mockApi";
import { renderApp } from "../test/renderApp";

async function fillCreateForm(options: {
  amount: string;
  categoryId: string;
  remarks?: string;
  transactionDate?: string;
  type?: "income" | "expense";
}) {
  const type = options.type ?? "expense";
  const transactionDate = options.transactionDate ?? "2026-03-20";
  const remarks = options.remarks ?? "";

  const typeField = screen.getByLabelText("Type");
  const amountField = screen.getByLabelText("Amount (HKD)");
  const categoryField = screen.getByLabelText("Category");
  const dateField = screen.getByLabelText("Transaction date");
  const remarksField = screen.getByPlaceholderText("Optional note about this entry");

  fireEvent.change(typeField, {
    target: {
      value: type,
    },
  });
  fireEvent.change(amountField, {
    target: {
      value: options.amount,
    },
  });
  fireEvent.change(categoryField, {
    target: {
      value: options.categoryId,
    },
  });
  fireEvent.change(dateField, {
    target: {
      value: transactionDate,
    },
  });
  fireEvent.change(remarksField, {
    target: {
      value: remarks,
    },
  });
}

describe("TransactionFormPage", () => {
  it("shows create-mode client validation errors and blocks submission", async () => {
    const mocks = mockAuthenticatedApi({
      getCategories: categoriesFixture,
    });

    renderApp({ route: "/transactions/new" });

    expect(await screen.findByRole("button", { name: "Create Transaction" })).toBeInTheDocument();

    const form = screen.getByRole("button", { name: "Create Transaction" }).closest("form");

    if (!form) {
      throw new Error("Expected the create transaction form to be rendered.");
    }

    fireEvent.submit(form);

    expect(
      await screen.findByText("Enter a valid HKD amount with up to 2 decimal places."),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose a category.")).toBeInTheDocument();
    expect(mocks.createTransaction).not.toHaveBeenCalled();
  });

  it("preloads an existing transaction in edit mode and submits the updated payload", async () => {
    const foodCategory = getCategoryBySlug("food");
    const existingTransaction = buildTransaction({
      id: "99999999-9999-4999-8999-999999999999",
      type: foodCategory.type,
      amountCents: 4_250,
      categoryId: foodCategory.id,
      categorySlug: foodCategory.slug,
      categoryName: foodCategory.name,
      transactionDate: "2026-03-19",
      remarks: "Lunch",
    });
    const mocks = mockAuthenticatedApi({
      getCategories: categoriesFixture,
      getTransaction: existingTransaction,
      updateTransaction: existingTransaction,
      listTransactions: buildTransactionListResponse([existingTransaction]),
    });
    const { user } = renderApp({
      route: `/transactions/${existingTransaction.id}/edit`,
    });

    expect(await screen.findByRole("button", { name: "Save Transaction" })).toBeInTheDocument();
    expect(mocks.getTransaction).toHaveBeenCalledWith(existingTransaction.id);
    expect(screen.getByLabelText("Type")).toHaveValue("expense");
    expect(screen.getByLabelText("Amount (HKD)")).toHaveValue("42.50");
    expect(screen.getByLabelText("Category")).toHaveValue(foodCategory.id);
    expect(screen.getByLabelText("Transaction date")).toHaveValue("2026-03-19");
    expect(screen.getByPlaceholderText("Optional note about this entry")).toHaveValue("Lunch");

    await user.clear(screen.getByLabelText("Amount (HKD)"));
    await user.type(screen.getByLabelText("Amount (HKD)"), "88.00");
    await user.clear(screen.getByPlaceholderText("Optional note about this entry"));
    await user.type(
      screen.getByPlaceholderText("Optional note about this entry"),
      "Dinner with team",
    );
    await user.click(screen.getByRole("button", { name: "Save Transaction" }));

    await waitFor(() => {
      expect(mocks.updateTransaction).toHaveBeenCalledWith(existingTransaction.id, {
        type: "expense",
        amountCents: 8_800,
        categoryId: foodCategory.id,
        transactionDate: "2026-03-19",
        remarks: "Dinner with team",
      });
    });

    expect(await screen.findByText("Newest first")).toBeInTheDocument();
  });

  it("filters category options by type and clears an incompatible selection when the type changes", async () => {
    const salaryCategory = getCategoryBySlug("salary");
    mockAuthenticatedApi({
      getCategories: categoriesFixture,
    });

    renderApp({ route: "/transactions/new" });

    expect(await screen.findByLabelText("Type")).toBeInTheDocument();

    const typeField = screen.getByLabelText("Type");
    const categoryField = screen.getByLabelText("Category");

    expect(within(categoryField).queryByRole("option", { name: "Salary" })).not.toBeInTheDocument();
    expect(within(categoryField).getByRole("option", { name: "Food" })).toBeInTheDocument();

    fireEvent.change(typeField, {
      target: {
        value: "income",
      },
    });

    expect(within(categoryField).getByRole("option", { name: "Salary" })).toBeInTheDocument();
    expect(within(categoryField).queryByRole("option", { name: "Food" })).not.toBeInTheDocument();

    fireEvent.change(categoryField, {
      target: {
        value: salaryCategory.id,
      },
    });
    expect(categoryField).toHaveValue(salaryCategory.id);

    fireEvent.change(typeField, {
      target: {
        value: "expense",
      },
    });

    await waitFor(() => {
      expect(categoryField).toHaveValue("");
    });

    expect(within(categoryField).getByRole("option", { name: "Food" })).toBeInTheDocument();
    expect(within(categoryField).queryByRole("option", { name: "Salary" })).not.toBeInTheDocument();
  });

  it("maps backend validation errors onto the create form fields", async () => {
    const foodCategory = getCategoryBySlug("food");
    const mocks = mockAuthenticatedApi({
      getCategories: categoriesFixture,
      createTransaction: createValidationError(
        {
          amountCents: ["Amount must be greater than zero"],
          categoryId: ["Choose a valid category."],
          remarks: ["Remarks must be 280 characters or fewer."],
        },
        "Request body failed validation",
      ),
    });
    const { user } = renderApp({ route: "/transactions/new" });

    expect(await screen.findByRole("button", { name: "Create Transaction" })).toBeInTheDocument();

    await fillCreateForm({
      type: "expense",
      amount: "12.34",
      categoryId: foodCategory.id,
      transactionDate: "2026-03-20",
      remarks: "Lunch",
    });

    await user.click(screen.getByRole("button", { name: "Create Transaction" }));

    await waitFor(() => {
      expect(mocks.createTransaction).toHaveBeenCalledWith({
        type: "expense",
        amountCents: 1_234,
        categoryId: foodCategory.id,
        transactionDate: "2026-03-20",
        remarks: "Lunch",
      });
    });

    expect(await screen.findByText("Request body failed validation")).toBeInTheDocument();
    expect(screen.getByText("Amount must be greater than zero")).toBeInTheDocument();
    expect(screen.getByText("Choose a valid category.")).toBeInTheDocument();
    expect(screen.getByText("Remarks must be 280 characters or fewer.")).toBeInTheDocument();
  });
});
