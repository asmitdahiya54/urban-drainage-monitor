import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";

type GoogleId = {
  accounts: {
    id: {
      initialize: (opts: {
        client_id: string;
        callback: (r: { credential: string }) => void;
        ux_mode?: "popup" | "redirect";
        auto_select?: boolean;
        use_fedcm_for_button?: boolean;
        use_fedcm_for_prompt?: boolean;
      }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
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
  const [ready, setReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef(loginWithGoogle);
  loginRef.current = loginWithGoogle;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    async function handleGoogleCredential(response: { credential: string }) {
      const credential = response.credential;
      setBusy(true);
      setError(null);
      try {
        const user = await loginRef.current(credential);
        navigate({ to: user.role === "admin" ? "/admin" : "/dashboard", replace: true });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Google sign-in failed. Please try again.");
      } finally {
        setBusy(false);
      }
    }

    loadGis()
      .then(() => {
        const google = (window as unknown as { google?: GoogleId }).google;
        const el = overlayRef.current;
        if (cancelled || !google || !el) return;
        // Button-only popup flow: no One Tap, no auto sign-in, no FedCM.
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          ux_mode: "popup",
          auto_select: false,
          use_fedcm_for_button: false,
          use_fedcm_for_prompt: false,
        });
        el.innerHTML = "";
        google.accounts.id.renderButton(el, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: Math.min(400, Math.max(200, Math.round(el.offsetWidth || 320))),
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach Google. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function handleFallbackClick() {
    if (!clientId) {
      setError("Google sign-in is not set up yet. Please use email and password for now.");
    } else if (!ready) {
      setError("Google sign-in is still loading. Please try again in a moment.");
    }
  }

  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={busy}
          tabIndex={ready ? -1 : 0}
          className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:border-primary hover:bg-secondary disabled:opacity-60"
        >
          <GoogleG />
          {busy ? "Signing in…" : label}
        </button>
        {/* Official Google button, invisible, stretched over the styled button to handle the click. */}
        <div
          ref={overlayRef}
          aria-label={label}
          className={`absolute inset-0 flex items-center justify-center overflow-hidden opacity-0 [&_iframe]:!w-full [&>div]:w-full ${
            ready && !busy ? "" : "pointer-events-none"
          }`}
          style={{ transform: "scale(1.02)" }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
