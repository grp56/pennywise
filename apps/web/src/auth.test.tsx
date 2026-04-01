import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./auth";
import { createUnauthorizedError, demoSession, mockApi } from "./test/mockApi";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function AuthHarness() {
  const { login, markSessionExpired, refreshSession, status, user } = useAuth();

  return (
    <div>
      <p>Status: {status}</p>
      <p>User: {user?.username ?? "none"}</p>
      <button
        type="button"
        onClick={() =>
          void login({
            username: "demo",
            password: "demo-password",
          })
        }
      >
        Log in
      </button>
      <button
        type="button"
        onClick={() => {
          void refreshSession();
        }}
      >
        Refresh session
      </button>
      <button type="button" onClick={markSessionExpired}>
        Expire session
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  it("ignores a stale bootstrap session check after a newer login succeeds", async () => {
    const bootstrapRequest = createDeferred<typeof demoSession>();
    const loginRequest = createDeferred<typeof demoSession>();
    const user = userEvent.setup();

    mockApi({
      getMe: vi.fn(() => bootstrapRequest.promise),
      login: vi.fn(() => loginRequest.promise),
    });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    expect(screen.getByText("Status: checking")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Log in" }));

    loginRequest.resolve(demoSession);

    expect(await screen.findByText("Status: authenticated")).toBeInTheDocument();
    expect(screen.getByText("User: demo")).toBeInTheDocument();

    bootstrapRequest.reject(createUnauthorizedError());

    await waitFor(() => {
      expect(screen.getByText("Status: authenticated")).toBeInTheDocument();
      expect(screen.getByText("User: demo")).toBeInTheDocument();
    });
  });

  it("ignores a stale refresh result after the session is explicitly expired", async () => {
    const bootstrapRequest = createDeferred<typeof demoSession>();
    const refreshRequest = createDeferred<typeof demoSession>();
    const user = userEvent.setup();
    let getMeCallCount = 0;

    mockApi({
      getMe: vi.fn(() => {
        getMeCallCount += 1;
        return getMeCallCount === 1 ? bootstrapRequest.promise : refreshRequest.promise;
      }),
    });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    bootstrapRequest.resolve(demoSession);

    expect(await screen.findByText("Status: authenticated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh session" }));
    await user.click(screen.getByRole("button", { name: "Expire session" }));

    expect(screen.getByText("Status: unauthenticated")).toBeInTheDocument();
    expect(screen.getByText("User: none")).toBeInTheDocument();

    refreshRequest.resolve(demoSession);

    await waitFor(() => {
      expect(screen.getByText("Status: unauthenticated")).toBeInTheDocument();
      expect(screen.getByText("User: none")).toBeInTheDocument();
    });
  });
});
