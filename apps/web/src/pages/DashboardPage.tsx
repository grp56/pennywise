import { Link } from "react-router-dom";

import { formatCurrencyFromCents, formatDateLabel } from "../lib/format";

const recentTransactions = [
  {
    id: "txn-preview-1",
    type: "income" as const,
    amountCents: 480000,
    categoryName: "Salary",
    categorySlug: "salary",
    remarks: "Monthly salary",
    transactionDate: "2026-03-05",
  },
  {
    id: "txn-preview-2",
    type: "expense" as const,
    amountCents: 12000,
    categoryName: "Food",
    categorySlug: "food",
    remarks: "Lunch",
    transactionDate: "2026-03-06",
  },
];

export function DashboardPage() {
  return (
    <div className="content-grid">
      <section className="hero-grid">
        <div className="hero-balance glass-panel">
          <p className="section-eyebrow">Total Liquidity</p>
          <h2 className="hero-balance__value">{formatCurrencyFromCents(468000)}</h2>
          <p className="muted-text">Static preview of the balance card for milestone review.</p>
        </div>

        <div className="summary-cards">
          <article className="summary-card">
            <p className="summary-card__label">Total Income</p>
            <p className="summary-card__value summary-card__value--positive">
              {formatCurrencyFromCents(480000)}
            </p>
          </article>

          <article className="summary-card">
            <p className="summary-card__label">Total Expense</p>
            <p className="summary-card__value summary-card__value--negative">
              {formatCurrencyFromCents(12000)}
            </p>
          </article>
        </div>
      </section>

      <section className="dashboard-panels">
        <article className="glass-panel panel-card">
          <div className="panel-card__header">
            <div>
              <p className="section-eyebrow">Recent Activity</p>
              <h3 className="panel-title">Preview entries</h3>
            </div>
            <Link className="inline-link" to="/transactions">
              View all
            </Link>
          </div>

          <div className="activity-list">
            {recentTransactions.map((transaction) => (
              <Link key={transaction.id} className="activity-row" to="/transactions">
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
        </article>
      </section>
    </div>
  );
}
