import type { ReactNode } from "react";

import { useAppLayoutContext } from "./AppLayout";

interface PageHeaderProps {
  actions?: ReactNode;
  description?: string;
  eyebrow: string;
  title: string;
}

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  const { openMobileNav } = useAppLayoutContext();

  return (
    <section className="page-header">
      <div className="page-header__title-row">
        <button
          type="button"
          className="icon-button mobile-nav-toggle page-header__menu"
          aria-label="Open navigation"
          onClick={openMobileNav}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            menu
          </span>
        </button>

        <div className="page-header__copy">
          <p className="section-eyebrow">{eyebrow}</p>
          <h1 className="panel-title panel-title--hero">{title}</h1>
          {description ? <p className="muted-text">{description}</p> : null}
        </div>
      </div>

      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </section>
  );
}
