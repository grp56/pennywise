import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  createUnauthorizedError,
  createValidationError,
  mockUnauthenticatedApi,
} from "../test/mockApi";
import { renderApp } from "../test/renderApp";

describe("LoginPage", () => {
  it("shows client-side validation errors when the form is submitted empty", async () => {
    const mocks = mockUnauthenticatedApi();
    const { user } = renderApp({ route: "/login" });

    await screen.findByRole("heading", { name: "Enter the seeded demo account" });

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.login).not.toHaveBeenCalled();
    expect(await screen.findByText("Username is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  it("shows the authentication error returned by the API for invalid credentials", async () => {
    const mocks = mockUnauthenticatedApi({
      login: createUnauthorizedError("Invalid username or password"),
    });
    const { user } = renderApp({ route: "/login" });

    await screen.findByRole("heading", { name: "Enter the seeded demo account" });

    await user.type(screen.getByLabelText("Username"), "demo");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.login).toHaveBeenCalledWith({
      username: "demo",
      password: "wrong-password",
    });
    expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("maps backend validation field errors back onto the login form", async () => {
    const mocks = mockUnauthenticatedApi({
      login: createValidationError({
        username: ["Username is required"],
        password: ["Password is required"],
      }),
    });
    const { user } = renderApp({ route: "/login" });

    await screen.findByRole("heading", { name: "Enter the seeded demo account" });

    await user.type(screen.getByLabelText("Username"), "demo");
    await user.type(screen.getByLabelText("Password"), "demo-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.login).toHaveBeenCalledWith({
      username: "demo",
      password: "demo-password",
    });
    expect(await screen.findByText("Request body failed validation")).toBeInTheDocument();
    expect(screen.getByText("Username is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });
});
