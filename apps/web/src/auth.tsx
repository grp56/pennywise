import type { AuthSession, AuthUser, LoginRequest } from "@pennywise/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  const authMutationVersionRef = useRef(0);

  const beginAuthMutation = useCallback(() => {
    authMutationVersionRef.current += 1;
    return authMutationVersionRef.current;
  }, []);

  const isLatestAuthMutation = useCallback((mutationVersion: number) => {
    return mutationVersion === authMutationVersionRef.current;
  }, []);

  const applyAuthState = useCallback(
    (mutationVersion: number, nextStatus: AuthStatus, nextUser: AuthUser | null) => {
      if (!isLatestAuthMutation(mutationVersion)) {
        return false;
      }

      setStatus(nextStatus);
      setUser(nextUser);
      return true;
    },
    [isLatestAuthMutation],
  );

  const refreshSession = useCallback(async () => {
    const mutationVersion = beginAuthMutation();

    try {
      const session = await apiClient.getMe();

      if (!applyAuthState(mutationVersion, "authenticated", session.user)) {
        return null;
      }

      return session;
    } catch (error) {
      if (!isLatestAuthMutation(mutationVersion)) {
        return null;
      }

      if (isApiClientError(error) && error.status === 401) {
        applyAuthState(mutationVersion, "unauthenticated", null);
        return null;
      }

      console.error(error);
      applyAuthState(mutationVersion, "unauthenticated", null);
      return null;
    }
  }, [applyAuthState, beginAuthMutation, isLatestAuthMutation]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (input: LoginRequest) => {
      const mutationVersion = beginAuthMutation();
      const session = await apiClient.login(input);

      applyAuthState(mutationVersion, "authenticated", session.user);
      return session;
    },
    [applyAuthState, beginAuthMutation],
  );

  const logout = useCallback(async () => {
    const mutationVersion = beginAuthMutation();

    try {
      await apiClient.logout();
    } finally {
      applyAuthState(mutationVersion, "unauthenticated", null);
    }
  }, [applyAuthState, beginAuthMutation]);

  const markSessionExpired = useCallback(() => {
    const mutationVersion = beginAuthMutation();
    applyAuthState(mutationVersion, "unauthenticated", null);
  }, [applyAuthState, beginAuthMutation]);

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
