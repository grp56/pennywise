import { Link } from "react-router-dom";

interface TransactionFormPageProps {
  mode: "create" | "edit";
}

export function TransactionFormPage({ mode }: TransactionFormPageProps) {
  return (
    <div className="content-grid">
      <section className="page-header">
        <div>
          <p className="section-eyebrow">
            {mode === "edit" ? "Edit Transaction" : "New Transaction"}
          </p>
          <h2 className="panel-title panel-title--hero">
            {mode === "edit" ? "Adjust an existing record" : "Record a new ledger entry"}
          </h2>
          <p className="muted-text">The static form layout is in place before backend wiring.</p>
        </div>

        <Link className="button-secondary" to="/transactions">
          Back to history
        </Link>
      </section>

      <section className="glass-panel form-panel">
        <form className="form-grid" noValidate>
          <div className="field-row">
            <label className="field">
              <span className="field__label">Type</span>
              <select className="field__control" defaultValue="expense">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>

            <label className="field">
              <span className="field__label">Amount (HKD)</span>
              <input className="field__control" defaultValue="" />
            </label>
          </div>

          <label className="field">
            <span className="field__label">Category</span>
            <select className="field__control" defaultValue="">
              <option value="">Choose a category</option>
              <option value="food">Food</option>
              <option value="salary">Salary</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">Transaction date</span>
            <input className="field__control" type="date" defaultValue="2026-03-11" />
          </label>

          <label className="field">
            <span className="field__label">Remarks</span>
            <textarea className="field__control field__control--textarea" rows="4" defaultValue="" />
          </label>

          <button className="button-primary" type="button">
            {mode === "edit" ? "Save changes later" : "Submit later"}
          </button>
        </form>
      </section>
    </div>
  );
}
