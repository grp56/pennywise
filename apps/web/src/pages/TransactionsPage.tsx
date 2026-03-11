import { Link } from "react-router-dom";

import { formatCurrencyFromCents, formatDateLabel } from "../lib/format";

const transactions = [
  {
    id: "txn-preview-1",
    type: "income" as const,
    amountCents: 480000,
    categoryName: "Salary",
    remarks: "Monthly salary",
    transactionDate: "2026-03-05",
  },
  {
    id: "txn-preview-2",
    type: "expense" as const,
    amountCents: 12000,
    categoryName: "Food",
    remarks: "Lunch",
    transactionDate: "2026-03-06",
  },
];

export function TransactionsPage() {
  return (
    <div className="content-grid">
      <section className="page-header">
        <div>
          <p className="section-eyebrow">Transaction History</p>
          <h2 className="panel-title panel-title--hero">Income and expense flow</h2>
          <p className="muted-text">Static filter and table shells prepared before API integration.</p>
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
          <select className="field__control" defaultValue="">
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>

        <label className="filter-card">
          <span className="field__label">Category</span>
          <select className="field__control" defaultValue="">
            <option value="">All categories</option>
            <option value="salary">Salary</option>
            <option value="food">Food</option>
          </select>
        </label>
      </section>

      <section className="glass-panel panel-card">
        <div className="activity-list">
          {transactions.map((transaction) => (
            <Link key={transaction.id} className="activity-row" to={`/transactions/${transaction.id}/edit`}>
              <div className="activity-row__meta">
                <span className={`pill ${transaction.type === "income" ? "pill--income" : "pill--expense"}`}>
                  {transaction.type}
                </span>
                <div>
                  <p className="activity-row__title">{transaction.categoryName}</p>
                  <p className="activity-row__subtitle">
                    {transaction.remarks} · {formatDateLabel(transaction.transactionDate)}
                  </p>
                </div>
              </div>

              <p className={transaction.type === "income" ? "amount amount--positive" : "amount amount--negative"}>
                {transaction.type === "income" ? "+" : "-"}
                {formatCurrencyFromCents(transaction.amountCents)}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
