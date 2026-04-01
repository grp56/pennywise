import { type Page, expect, test } from "@playwright/test";

import { type E2EStack, startE2EStack } from "./helpers";

let stack: E2EStack;

function transactionRow(page: Page, text: string) {
  return page.locator("article.history-row").filter({ hasText: text });
}

async function createTransaction(
  page: Page,
  stackState: E2EStack,
  input: {
    amount: string;
    category: string;
    remarks: string;
    transactionDate: string;
    type: "income" | "expense";
  },
) {
  await page.goto(`${stackState.webBaseUrl}/transactions/new`);
  await expect(page.getByRole("heading", { name: "Record a new ledger entry" })).toBeVisible();

  await page.getByLabel("Type").selectOption(input.type);
  await page.getByLabel("Amount (HKD)").fill(input.amount);
  await page.getByLabel("Category").selectOption({ label: input.category });
  await page.getByLabel("Transaction date").fill(input.transactionDate);
  await page.getByPlaceholder("Optional note about this entry").fill(input.remarks);
  await page.getByRole("button", { name: "Create Transaction" }).click();

  await page.waitForURL("**/transactions");
}

test.describe("core seeded flows", () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    stack = await startE2EStack();
  });

  test.afterAll(async () => {
    await stack?.close();
  });

  test("seeded user can log in, create, edit, filter, refresh, and delete transactions", async ({
    page,
  }) => {
    const incomeRemarks = "Playwright salary income";
    const expenseRemarks = "Playwright food expense";
    const editedExpenseRemarks = "Playwright edited food expense";

    await page.goto(`${stack.webBaseUrl}/login`);
    await expect(
      page.getByRole("heading", { name: "Enter the seeded demo account" }),
    ).toBeVisible();

    await page.getByLabel("Username").fill(stack.demoUsername);
    await page.getByLabel("Password").fill(stack.demoPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByText(stack.demoUsername)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keep the ledger current" })).toBeVisible();

    await createTransaction(page, stack, {
      type: "income",
      amount: "1234.56",
      category: "Salary",
      transactionDate: "2026-04-10",
      remarks: incomeRemarks,
    });

    await expect(transactionRow(page, incomeRemarks)).toBeVisible();

    await createTransaction(page, stack, {
      type: "expense",
      amount: "54.32",
      category: "Food",
      transactionDate: "2026-04-11",
      remarks: expenseRemarks,
    });

    const expenseRow = transactionRow(page, expenseRemarks);
    await expect(expenseRow).toBeVisible();

    await expenseRow.getByRole("link", { name: "Edit" }).click();

    await page.waitForURL("**/transactions/*/edit");
    await expect(page.getByRole("heading", { name: "Adjust an existing record" })).toBeVisible();
    await page.getByLabel("Amount (HKD)").fill("65.43");
    await page.getByPlaceholder("Optional note about this entry").fill(editedExpenseRemarks);
    await page.getByRole("button", { name: "Save Transaction" }).click();

    await page.waitForURL("**/transactions");
    await expect(transactionRow(page, editedExpenseRemarks)).toBeVisible();
    await expect(transactionRow(page, expenseRemarks)).toHaveCount(0);

    await page.getByLabel("Type").selectOption("expense");
    await expect(page).toHaveURL(/type=expense/);
    await page.getByLabel("Category").selectOption({ label: "Food" });
    await expect(transactionRow(page, editedExpenseRemarks)).toBeVisible();
    await expect(transactionRow(page, incomeRemarks)).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/type=expense/);
    await expect(page.getByText(stack.demoUsername)).toBeVisible();
    await expect(transactionRow(page, editedExpenseRemarks)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await transactionRow(page, editedExpenseRemarks)
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page.getByText("Nothing matches the current filters")).toBeVisible();

    await page.getByRole("link", { name: "Transactions" }).click();
    await page.waitForURL("**/transactions");
    await expect(transactionRow(page, incomeRemarks)).toBeVisible();
    await expect(transactionRow(page, editedExpenseRemarks)).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(stack.demoUsername)).toBeVisible();
    await expect(transactionRow(page, incomeRemarks)).toBeVisible();
    await expect(transactionRow(page, editedExpenseRemarks)).toHaveCount(0);
  });
});
