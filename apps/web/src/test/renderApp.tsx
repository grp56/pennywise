import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";

export interface RenderAppOptions {
  initialEntries?: string[];
  route?: string;
}

function resolveInitialEntries(options: RenderAppOptions): string[] {
  return options.initialEntries ?? [options.route ?? "/"];
}

export function renderApp(options: RenderAppOptions = {}) {
  const user = userEvent.setup();

  return {
    user,
    ...render(
      <MemoryRouter initialEntries={resolveInitialEntries(options)}>
        <App />
      </MemoryRouter>,
    ),
  };
}
