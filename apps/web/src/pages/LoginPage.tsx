export function LoginPage() {
  return (
    <main className="login-screen">
      <section className="login-hero">
        <p className="section-eyebrow">Architectural Ledger</p>
        <h1 className="login-title">A calm ledger for income, expenses, and daily balance.</h1>
        <p className="login-copy">
          This milestone focuses on the static sign-in surface before wiring the real session flow.
        </p>
      </section>

      <section className="login-card glass-panel">
        <div className="login-card__header">
          <p className="section-eyebrow">Sign In</p>
          <h2 className="panel-title">Preview the seeded account screen</h2>
          <p className="muted-text">Interactive validation and backend authentication arrive later.</p>
        </div>

        <form className="form-grid" noValidate>
          <label className="field">
            <span className="field__label">Username</span>
            <input className="field__control" name="username" defaultValue="demo" readOnly />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input className="field__control" name="password" type="password" defaultValue="demo-password" readOnly />
          </label>

          <button className="button-primary button-primary--full" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">
              lock_open
            </span>
            <span>Interactive login arrives later</span>
          </button>
        </form>
      </section>
    </main>
  );
}
