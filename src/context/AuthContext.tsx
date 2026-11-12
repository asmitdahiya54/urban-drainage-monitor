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
import { isDemoToken } from "@/lib/demoAuth";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** true while the stored token is being validated on first load */
  loading: boolean;
  loginWithGoogle: (credential: string) => Promise<AuthUser>;
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
    if (isDemoToken(stored)) {
      setStoredToken(null);
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

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const data = await authApi.google(credential);
      return adopt(data.access_token, data.user);
    },
    [adopt],
  );

  const logout = useCallback(() => {
    const stored = getStoredToken();
    // Backend logout is stateless; notify it for real sessions, ignore failures.
    if (stored && !isDemoToken(stored)) authApi.logout().catch(() => undefined);
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
      loginWithGoogle,
      logout,
    }),
    [user, token, loading, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
