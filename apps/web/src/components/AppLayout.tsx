import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from "react-router-dom";

import { useAuth } from "../auth";

const navigationItems = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: "dashboard",
  },
  {
    label: "Transactions",
    to: "/transactions",
    icon: "receipt_long",
  },
];

interface AppLayoutOutletContext {
  openMobileNav: () => void;
}

export function useAppLayoutContext() {
  return useOutletContext<AppLayoutOutletContext>();
}

export function AppLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logout();
      navigate("/login", {
        replace: true,
      });
    } finally {
      setLoggingOut(false);
      setMobileNavOpen(false);
    }
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  return (
    <div className="app-frame">
      <button
        type="button"
        className={`app-frame__scrim ${mobileNavOpen ? "is-visible" : ""}`}
        aria-label="Close navigation"
        aria-hidden={!mobileNavOpen}
        onClick={closeMobileNav}
      />

      <aside className={`side-nav ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="brand-block">
          <p className="brand-mark">Pennywise</p>
          <p className="brand-caption">Personal finance</p>
        </div>

        <nav className="nav-stack" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link nav-link--active" : "nav-link")}
              onClick={closeMobileNav}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="side-nav__footer">
          <Link
            className="button-primary button-primary--full"
            to="/transactions/new"
            data-testid="app-layout-add-transaction"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            <span>Add Transaction</span>
          </Link>

          <button
            type="button"
            className="button-secondary button-secondary--full"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              logout
            </span>
            <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </aside>

      <div className="app-content">
        <main className="page-shell">
          <Outlet
            context={{
              openMobileNav: () => setMobileNavOpen(true),
            }}
          />
        </main>
      </div>
    </div>
  );
}
