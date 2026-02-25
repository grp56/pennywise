import type { TransactionType } from "@pennywise/contracts";

export interface SeedCategory {
  slug: string;
  name: string;
  type: TransactionType;
}

export const seedCategories: SeedCategory[] = [
  { slug: "salary", name: "Salary", type: "income" },
  { slug: "allowance", name: "Allowance", type: "income" },
  { slug: "bonus", name: "Bonus", type: "income" },
  { slug: "gift", name: "Gift", type: "income" },
  { slug: "other-income", name: "Other Income", type: "income" },
  { slug: "food", name: "Food", type: "expense" },
  { slug: "transport", name: "Transport", type: "expense" },
  { slug: "shopping", name: "Shopping", type: "expense" },
  { slug: "bills", name: "Bills", type: "expense" },
  { slug: "entertainment", name: "Entertainment", type: "expense" },
  { slug: "education", name: "Education", type: "expense" },
  { slug: "healthcare", name: "Healthcare", type: "expense" },
  { slug: "other-expense", name: "Other Expense", type: "expense" },
];
