/**
 * Client-side route protection.
 *
 * The backend is a separate Flask API, so the session lives in the browser:
 * this guard waits for AuthContext to finish validating the token, then
 * redirects unauthenticated visitors to /login and shows an "unauthorized"
 * screen to signed-in users who lack the required role.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/context/AuthContext";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import type { UserRole } from "@/services/api";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-20 text-center">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: UserRole }) {
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login", replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </Shell>
    );
  }

  if (!isAuthenticated) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      </Shell>
    );
  }

  if (role && user?.role !== role) {
    return (
      <Shell>
        <h1 className="text-3xl font-bold sm:text-4xl">Unauthorized</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          This area is restricted to {role} accounts. Your account is signed in as{" "}
          <span className="font-medium text-foreground">{user?.role}</span>.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to my dashboard
        </Link>
      </Shell>
    );
  }

  return <>{children}</>;
}
