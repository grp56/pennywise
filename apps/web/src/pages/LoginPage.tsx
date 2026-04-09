import { loginRequestSchema } from "@pennywise/contracts";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { LoadingScreen } from "../components/LoadingScreen";
import { getValidationFieldErrors, isApiClientError } from "../lib/api";

type LoginFieldErrors = Record<"password" | "username", string | undefined>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login, status } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({
    username: undefined,
    password: undefined,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "checking") {
    return <LoadingScreen label="Checking your session..." />;
  }

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({
      username: undefined,
      password: undefined,
    });

    const parsed = loginRequestSchema.safeParse({
      username,
      password,
    });

    if (!parsed.success) {
      const nextErrors = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        username: nextErrors.username?.[0],
        password: nextErrors.password?.[0],
      });
      return;
    }

    setSubmitting(true);

    try {
      await login(parsed.data);
      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      if (isApiClientError(error)) {
        const validationErrors = getValidationFieldErrors(error);

        if (validationErrors) {
          setFieldErrors({
            username: validationErrors.username?.[0],
            password: validationErrors.password?.[0],
          });
        }

        setFormError(error.responseBody?.message ?? "Sign in failed.");
      } else {
        console.error(error);
        setFormError("Sign in failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-hero">
        <p className="section-eyebrow">Personal finance</p>
        <h1 className="login-title">Track your balance in one clear view.</h1>
        <p className="login-copy">
          Record income and expenses, review recent activity, and stay on top of everyday spending.
        </p>
      </section>

      <section className="login-card glass-panel">
        <div className="login-card__header">
          <p className="section-eyebrow">Sign In</p>
          <h2 className="panel-title">Sign in to Pennywise</h2>
          <p className="muted-text">Enter your username and password to continue.</p>
        </div>

        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <label className="field" htmlFor="login-username">
            <span className="field__label">Username</span>
            <input
              id="login-username"
              className="field__control"
              name="username"
              autoComplete="username"
              value={username}
              aria-invalid={fieldErrors.username ? "true" : "false"}
              aria-describedby={fieldErrors.username ? "login-username-error" : undefined}
              onChange={(event) => setUsername(event.target.value)}
            />
            {fieldErrors.username ? (
              <span
                id="login-username-error"
                className="field__error"
                role="alert"
                aria-live="polite"
              >
                {fieldErrors.username}
              </span>
            ) : null}
          </label>

          <label className="field" htmlFor="login-password">
            <span className="field__label">Password</span>
            <input
              id="login-password"
              className="field__control"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={fieldErrors.password ? "true" : "false"}
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {fieldErrors.password ? (
              <span
                id="login-password-error"
                className="field__error"
                role="alert"
                aria-live="polite"
              >
                {fieldErrors.password}
              </span>
            ) : null}
          </label>

          {formError ? (
            <p className="form-error-banner" role="alert" aria-live="assertive">
              {formError}
            </p>
          ) : null}

          <button
            className="button-primary button-primary--full"
            type="submit"
            disabled={submitting}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              lock_open
            </span>
            <span>{submitting ? "Signing in..." : "Sign in"}</span>
          </button>
        </form>
      </section>
    </main>
  );
}
