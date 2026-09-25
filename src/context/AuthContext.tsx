/**
 * Single source of truth for authentication state.
 *
 * On mount it restores the token from localStorage and validates it against
 * GET /api/auth/me, so a tampered or expired token never yields a signed-in UI.
 * Logout is client-side token removal (stateless JWT — see README).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError, authApi, getStoredToken, setStoredToken, type AuthUser } from "@/services/api";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** true while the stored token is being validated on first load */
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    authApi
      .me(stored)
      .then(({ user: fetched }) => {
        if (cancelled) return;
        setUser(fetched);
        setToken(stored);
      })
      .catch((error) => {
        // Expired/invalid token: drop it. Network error: keep it for a retry.
        if (error instanceof ApiError && error.status === 401) setStoredToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback((accessToken: string, nextUser: AuthUser) => {
    setStoredToken(accessToken);
    setToken(accessToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login({ email, password });
      return adopt(data.access_token, data.user);
    },
    [adopt],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await authApi.register({ name, email, password });
      return adopt(data.access_token, data.user);
    },
    [adopt],
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin",
      loading,
      login,
      register,
      logout,
    }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
