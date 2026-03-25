import type { AuthSession, AuthUser, LoginRequest } from "@pennywise/contracts";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiClient, isApiClientError } from "./lib/api";

export type AuthStatus = "authenticated" | "checking" | "unauthenticated";

interface AuthContextValue {
  login: (input: LoginRequest) => Promise<AuthSession>;
  logout: () => Promise<void>;
  markSessionExpired: () => void;
  refreshSession: () => Promise<AuthSession | null>;
  status: AuthStatus;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const session = await apiClient.getMe();
      setStatus("authenticated");
      setUser(session.user);
      return session;
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        setStatus("unauthenticated");
        setUser(null);
        return null;
      }

      console.error(error);
      setStatus("unauthenticated");
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (input: LoginRequest) => {
    const session = await apiClient.login(input);
    setStatus("authenticated");
    setUser(session.user);
    return session;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } finally {
      setStatus("unauthenticated");
      setUser(null);
    }
  }, []);

  const markSessionExpired = useCallback(() => {
    setStatus("unauthenticated");
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      login,
      logout,
      markSessionExpired,
      refreshSession,
      status,
      user,
    }),
    [login, logout, markSessionExpired, refreshSession, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
