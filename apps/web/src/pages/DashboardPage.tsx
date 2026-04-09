import type { SummaryResponse, Transaction } from "@pennywise/contracts";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth";
import { PageHeader } from "../components/PageHeader";
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

  const header = (
    <PageHeader
      eyebrow="Dashboard"
      title="Your balance at a glance"
      description="See your current balance, recent activity, and quick actions in one place."
    />
  );

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
      <div className="content-grid">
        {header}

        <section className="hero-grid">
          <div className="hero-balance">
            <p className="section-eyebrow">Current balance</p>
            <h2 className="hero-balance__value">Loading...</h2>
            <p className="muted-text">Loading your balance and recent activity.</p>
          </div>
        </section>
      </div>
    );
  }

  if (errorMessage || !state.summary) {
    return (
      <div className="content-grid">
        {header}

        <section className="content-grid">
          <div className="glass-panel empty-state" role="alert" aria-live="assertive">
            <h2 className="panel-title">Dashboard unavailable</h2>
            <p className="muted-text">{errorMessage ?? "Summary data is missing."}</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="content-grid">
      {header}

      <section className="hero-grid">
        <div className="hero-balance">
          <p className="section-eyebrow">Current balance</p>
          <h2 className="hero-balance__value">
            {formatCurrencyFromCents(state.summary.balanceCents)}
          </h2>
          <p className="muted-text">Based on your recorded income and expenses.</p>
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
              <h3 className="panel-title">Recent transactions</h3>
            </div>
            <Link className="inline-link" to="/transactions">
              View all
            </Link>
          </div>

          {state.recentTransactions.length === 0 ? (
            <div className="empty-state">
              <p className="panel-title">No transactions yet</p>
              <p className="muted-text">Add your first income or expense to get started.</p>
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
                    {formatCurrencyFromCents(transaction.amountCents)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="glass-panel insight-card">
          <p className="section-eyebrow">Next Step</p>
          <h3 className="panel-title">Add your next transaction</h3>
          <p className="muted-text">
            Record income or expenses, then review the full history anytime.
          </p>
          <div className="insight-card__actions">
            <Link className="button-primary" to="/transactions/new">
              Add Transaction
            </Link>
            <Link className="button-secondary" to="/transactions">
              View History
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
