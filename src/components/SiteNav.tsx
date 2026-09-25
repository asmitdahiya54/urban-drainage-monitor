import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useAuth } from "@/context/AuthContext";

const guestLinks = [
  { to: "/", label: "Home" },
  { to: "/city", label: "3D City" },
  { to: "/report", label: "Report Issue" },
  { to: "/map", label: "Map" },
] as const;

const citizenLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/city", label: "3D City" },
  { to: "/report", label: "Report Issue" },
  { to: "/reports", label: "My Reports" },
  { to: "/map", label: "Map" },
] as const;

const adminLinks = [
  { to: "/admin", label: "Dashboard" },
  { to: "/city", label: "3D City" },
  { to: "/admin/map", label: "Reports Map" },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, isAdmin, user, logout, loading } = useAuth();
  const navigate = useNavigate();

  // Signed-out visitors, citizens and admins each get their own set of links.
  const links = !isAuthenticated
    ? [...guestLinks]
    : isAdmin
      ? [{ to: "/", label: "Home" } as const, ...adminLinks]
      : [...citizenLinks];

  function handleLogout() {
    logout();
    setOpen(false);
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-display text-sm font-bold shadow-glow">
            UD
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Urban Drainage Monitor
          </span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "text-foreground bg-secondary" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            </li>
          ))}

          {loading ? null : isAuthenticated ? (
            <>
              <li className="ml-2 hidden text-sm text-muted-foreground lg:block">{user?.email}</li>
              <li>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  Log out
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link
                  to="/login"
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "text-foreground bg-secondary" }}
                >
                  Login
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="ml-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Create account
                </Link>
              </li>
            </>
          )}
        </ul>

        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-border p-2 md:hidden"
        >
          <span className="block h-0.5 w-5 bg-foreground" />
          <span className="mt-1 block h-0.5 w-5 bg-foreground" />
          <span className="mt-1 block h-0.5 w-5 bg-foreground" />
        </button>
      </nav>

      {open && (
        <ul className="border-t border-border bg-background px-5 py-2 md:hidden">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            </li>
          ))}
          {isAuthenticated ? (
            <li>
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full rounded-md px-2 py-2.5 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Log out
              </button>
            </li>
          ) : (
            <>
              <li>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Login
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2.5 text-sm font-semibold text-primary"
                >
                  Create account
                </Link>
              </li>
            </>
          )}
        </ul>
      )}
    </header>
  );
}
