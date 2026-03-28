import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";

export interface RenderAppOptions {
  initialEntries?: string[];
  route?: string;
}

export function renderApp(options: RenderAppOptions = {}) {
  const initialEntries = options.initialEntries ?? [options.route ?? "/"];
  const user = userEvent.setup();

  return {
    user,
    ...render(
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>,
    ),
  };
}
