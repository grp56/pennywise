import { Link, NavLink, Outlet } from "react-router-dom";

const navigationItems = [
  { label: "Dashboard", to: "/dashboard", icon: "dashboard" },
  { label: "Transactions", to: "/transactions", icon: "receipt_long" },
];

export function AppLayout() {
  return (
    <div className="app-frame">
      <aside className="side-nav">
        <div className="brand-block">
          <p className="brand-mark">Pennywise</p>
          <p className="brand-caption">Prototype Mode</p>
        </div>

        <nav className="nav-stack" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link nav-link--active" : "nav-link")}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="side-nav__footer">
          <Link className="button-primary button-primary--full" to="/transactions/new">
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            <span>Add Transaction</span>
          </Link>
        </div>
      </aside>

      <div className="app-content">
        <header className="top-bar">
          <div className="top-bar__leading">
            <div>
              <p className="section-eyebrow">Personal Finance Tracking</p>
              <h1 className="section-title">Pennywise</h1>
            </div>
          </div>

          <div className="top-bar__account">
            <div className="account-chip">
              <span className="material-symbols-outlined" aria-hidden="true">
                visibility
              </span>
              <span>Static preview</span>
            </div>
          </div>
        </header>

        <main className="page-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
