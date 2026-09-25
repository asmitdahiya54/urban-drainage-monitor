import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";

type GoogleId = {
  accounts: {
    id: {
      initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      prompt: () => void;
    };
  };
};

const clientId = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;
let scriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleSignInButton({ label = "Continue with Google" }: { label?: string }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (clientId) loadGis().catch(() => undefined);
  }, []);

  async function handleClick() {
    setError(null);
    if (!clientId) {
      setError("Google sign-in is not set up yet. Please use email and password for now.");
      return;
    }
    try {
      await loadGis();
      const google = (window as unknown as { google?: GoogleId }).google;
      if (!google) throw new Error("load");
      if (!initialized.current) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            setBusy(true);
            try {
              const user = await loginWithGoogle(credential);
              navigate({ to: user.role === "admin" ? "/admin" : "/dashboard", replace: true });
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Google sign-in failed. Please try again.");
            } finally {
              setBusy(false);
            }
          },
        });
        initialized.current = true;
      }
      google.accounts.id.prompt();
    } catch {
      setError("Could not reach Google. Check your connection and try again.");
    }
  }

  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:border-primary hover:bg-secondary disabled:opacity-60"
      >
        <GoogleG />
        {busy ? "Signing in…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
