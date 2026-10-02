/**
 * FRONTEND DEMO AUTHENTICATION — NOT PRODUCTION, NOT SECURE.
 *
 * Only active in development builds or when VITE_ENABLE_DEMO_AUTH="true".
 * Accounts live in this browser's localStorage; passwords are stored in plain
 * text and nothing is verified by a server. Remove once the Flask backend
 * handles all sign-ins. Demo credentials are documented in DEMO_CREDENTIALS.md.
 */
import type { AuthUser, UserRole } from "@/services/api";

export const DEMO_AUTH_ENABLED =
  import.meta.env.DEV || import.meta.env["VITE_ENABLE_DEMO_AUTH"] === "true";

export const DEMO_TOKEN_PREFIX = "demo-session:";
const USERS_KEY = "udm.demo_users";

type DemoUser = AuthUser & { password: string };

const SEED: DemoUser[] = DEMO_AUTH_ENABLED
  ? [
      { id: -1, name: "Demo Citizen", email: "citizen@demo.local", role: "citizen", password: "Citizen@123", created_at: "2026-01-01T00:00:00Z" },
      { id: -2, name: "Demo Admin", email: "admin@demo.local", role: "admin", password: "Admin@123", created_at: "2026-01-01T00:00:00Z" },
    ]
  : [];

function readUsers(): DemoUser[] {
  if (typeof window === "undefined") return SEED;
  try {
    const stored = JSON.parse(window.localStorage.getItem(USERS_KEY) ?? "[]") as DemoUser[];
    return [...SEED, ...stored];
  } catch {
    return SEED;
  }
}

function strip({ password: _p, ...user }: DemoUser): AuthUser {
  return user as AuthUser;
}

export class DemoAuthError extends Error {
  field?: string | undefined;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

export function isDemoToken(token: string | null): boolean {
  return Boolean(token?.startsWith(DEMO_TOKEN_PREFIX));
}

export function demoLogin(email: string, password: string) {
  const user = readUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) throw new DemoAuthError("Incorrect email or password.");
  return { access_token: DEMO_TOKEN_PREFIX + user.email, user: strip(user) };
}

export function demoRegister(name: string, email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (readUsers().some((u) => u.email.toLowerCase() === normalized))
    throw new DemoAuthError("An account with this email already exists.", "email");
  const role: UserRole = "citizen";
  const user: DemoUser = { id: -Date.now(), name: name.trim(), email: normalized, role, password, created_at: new Date().toISOString() };
  const stored = readUsers().filter((u) => u.id < -2 || !SEED.some((s) => s.id === u.id));
  window.localStorage.setItem(USERS_KEY, JSON.stringify([...stored, user]));
  return { access_token: DEMO_TOKEN_PREFIX + user.email, user: strip(user) };
}

export function demoUserFromToken(token: string): AuthUser | null {
  const email = token.slice(DEMO_TOKEN_PREFIX.length);
  const user = readUsers().find((u) => u.email === email);
  return user ? strip(user) : null;
}
