import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Droplet, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";

type NavLink = { to: string; label: string };

const guestLinks: NavLink[] = [
  { to: "/", label: "Home" },
  { to: "/report", label: "Report Issue" },
  { to: "/city", label: "3D City" },
  { to: "/map", label: "Issues Map" },
  { to: "/about", label: "About" },
];

const citizenLinks: NavLink[] = [
  { to: "/", label: "Home" },
  { to: "/report", label: "Report Issue" },
  { to: "/city", label: "3D City" },
  { to: "/map", label: "Issues Map" },
  { to: "/dashboard", label: "Analytics" },
  { to: "/about", label: "About" },
];

const adminLinks: NavLink[] = [
  { to: "/", label: "Home" },
  { to: "/city", label: "3D City" },
  { to: "/admin/map", label: "Issues Map" },
  { to: "/admin", label: "Analytics" },
  { to: "/about", label: "About" },
];

export function SiteNav({ variant = "default" }: { variant?: "default" | "dashboard" }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, isAdmin, user, logout, loading } = useAuth();
  const navigate = useNavigate();

  const links = !isAuthenticated ? guestLinks : isAdmin ? adminLinks : citizenLinks;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  function handleLogout() {
    logout();
    setOpen(false);
    setMenuOpen(false);
    navigate({ to: "/", replace: true });
  }

  const dash = variant === "dashboard";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <header
      className={
        dash
          ? "sticky top-0 z-40 border-b border-city-line bg-city/80 text-city-foreground backdrop-blur-xl"
          : "sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl"
      }
    >
      <nav className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-5 py-3">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Droplet className="size-8 fill-primary/80 text-primary drop-shadow-[0_0_10px_var(--color-primary)]" />
          <span className="leading-tight">
            <span className="block font-display text-base font-semibold tracking-tight">
              Urban Drainage Monitor
            </span>
            <span className="block text-[11px] opacity-70">Smarter Drainage · Cleaner Cities</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="relative rounded-md px-3 py-2 text-sm font-medium opacity-75 transition hover:opacity-100"
                activeProps={{
                  className:
                    "!opacity-100 text-primary after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary after:shadow-[0_0_8px_var(--color-primary)]",
                }}
                activeOptions={{ exact: l.to === "/" || l.to === "/admin" }}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          {loading ? null : isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full px-2 py-1.5 text-sm transition hover:bg-secondary/60"
              >
                <span className="flex size-8 items-center justify-center rounded-full border border-primary/40">
                  <UserRound className="size-4" />
                </span>
                Hello, {firstName}
                <ChevronDown className="size-4 opacity-70" />
                <span className="ml-1 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary">
                  {isAdmin ? "Admin" : "Citizen"}
                </span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg"
                >
                  <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user?.email}</p>
                  <Link
                    to={isAdmin ? "/admin" : "/dashboard"}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm hover:bg-secondary"
                  >
                    Profile
                  </Link>
                  {!isAdmin && (
                    <Link
                      to="/reports"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm hover:bg-secondary"
                    >
                      My Reports
                    </Link>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md px-3 py-2 text-sm font-medium opacity-80 hover:opacity-100"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-full border border-primary px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
              >
                Create Account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-border p-2 lg:hidden"
        >
          <span className="block h-0.5 w-5 bg-foreground" />
          <span className="mt-1 block h-0.5 w-5 bg-foreground" />
          <span className="mt-1 block h-0.5 w-5 bg-foreground" />
        </button>
      </nav>

      {open && (
        <ul className="border-t border-border bg-background px-5 py-2 text-foreground lg:hidden">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
                activeOptions={{ exact: l.to === "/" || l.to === "/admin" }}
              >
                {l.label}
              </Link>
            </li>
          ))}
          {isAuthenticated ? (
            <>
              {!isAdmin && (
                <li>
                  <Link
                    to="/reports"
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    My Reports
                  </Link>
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full rounded-md px-2 py-2.5 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
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
                  Create Account
                </Link>
              </li>
            </>
          )}
        </ul>
      )}
    </header>
  );
}
