import type { SummaryResponse, Transaction } from "@pennywise/contracts";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth";
import { apiClient, isApiClientError } from "../lib/api";
import { formatCurrencyFromCents, formatDateLabel } from "../lib/format";

interface DashboardState {
  recentTransactions: Transaction[];
  summary: SummaryResponse | null;
}

export function DashboardPage() {
  const { markSessionExpired } = useAuth();
  const [state, setState] = useState<DashboardState>({
    recentTransactions: [],
    summary: null,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [summary, recentTransactions] = await Promise.all([
          apiClient.getSummary(),
          apiClient.listTransactions({
            page: 1,
            pageSize: 5,
          }),
        ]);

        if (ignore) {
          return;
        }

        setState({
          summary,
          recentTransactions: recentTransactions.items,
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
        setErrorMessage("Dashboard data could not be loaded.");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, [markSessionExpired]);

  if (loading) {
    return (
      <section className="hero-grid">
        <div className="hero-balance glass-panel">
          <p className="section-eyebrow">Total Liquidity</p>
          <h2 className="hero-balance__value">Loading...</h2>
          <p className="muted-text">Retrieving summary and recent activity.</p>
        </div>
      </section>
    );
  }

  if (errorMessage || !state.summary) {
    return (
      <section className="content-grid">
        <div className="glass-panel empty-state" role="alert" aria-live="assertive">
          <h2 className="panel-title">Dashboard unavailable</h2>
          <p className="muted-text">{errorMessage ?? "Summary data is missing."}</p>
        </div>
      </section>
    );
  }

  return (
    <div className="content-grid">
      <section className="hero-grid">
        <div className="hero-balance glass-panel">
          <p className="section-eyebrow">Total Liquidity</p>
          <h2 className="hero-balance__value">
            {formatCurrencyFromCents(state.summary.balanceCents)}
          </h2>
          <p className="muted-text">Current balance derived from all persisted transactions.</p>
        </div>

        <div className="summary-cards">
          <article className="summary-card">
            <p className="summary-card__label">Total Income</p>
            <p className="summary-card__value summary-card__value--positive">
              {formatCurrencyFromCents(state.summary.totalIncomeCents)}
            </p>
          </article>

          <article className="summary-card">
            <p className="summary-card__label">Total Expense</p>
            <p className="summary-card__value summary-card__value--negative">
              {formatCurrencyFromCents(state.summary.totalExpenseCents)}
            </p>
          </article>
        </div>
      </section>

      <section className="dashboard-panels">
        <article className="glass-panel panel-card">
          <div className="panel-card__header">
            <div>
              <p className="section-eyebrow">Recent Activity</p>
              <h3 className="panel-title">Last 5 entries</h3>
            </div>
            <Link className="inline-link" to="/transactions">
              View all
            </Link>
          </div>

          {state.recentTransactions.length === 0 ? (
            <div className="empty-state">
              <p className="panel-title">No transactions yet</p>
              <p className="muted-text">
                Create the first income or expense record to populate the dashboard.
              </p>
              <Link
                className="button-primary"
                to="/transactions/new"
                data-testid="dashboard-empty-add-transaction"
              >
                Add Transaction
              </Link>
            </div>
          ) : (
            <div className="activity-list">
              {state.recentTransactions.map((transaction) => (
                <Link
                  key={transaction.id}
                  className="activity-row"
                  to={`/transactions/${transaction.id}/edit`}
                >
                  <div className="activity-row__meta">
                    <span
                      className={`pill ${transaction.type === "income" ? "pill--income" : "pill--expense"}`}
                    >
                      {transaction.type}
                    </span>
                    <div>
                      <p className="activity-row__title">{transaction.categoryName}</p>
                      <p className="activity-row__subtitle">
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
                    {formatCurrencyFromCents(transaction.amountCents).replace("HK$", "HK$")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="glass-panel insight-card">
          <p className="section-eyebrow">Next Step</p>
          <h3 className="panel-title">Keep the ledger current</h3>
          <p className="muted-text">
            Transaction history, edit flow, and filters all rely on the same backend contracts as
            the dashboard summary.
          </p>
          <div className="insight-card__actions">
            <Link className="button-primary" to="/transactions/new">
              Record Entry
            </Link>
            <Link className="button-secondary" to="/transactions">
              Open History
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
