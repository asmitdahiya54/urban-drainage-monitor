import { useEffect, useRef, useState } from "react";

import { GOOGLE_CLIENT_ID } from "@/config/google";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";

type GoogleSignInButtonProps = {
  label?: string;
};

type GoogleCredentialResponse = { credential?: string };

type GoogleIdApi = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisPromise: Promise<GoogleIdApi> | null = null;

/** Load Google Identity Services once per page. */
function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const api = window.google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error("Google sign-in library loaded without its API"));
    };
    script.onerror = () => reject(new Error("Could not load Google sign-in"));
    document.head.appendChild(script);
  }).catch((error) => {
    gisPromise = null;
    throw error;
  });
  return gisPromise;
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return "Google sign-in isn't available on the server right now. Please try again later or use email and password.";
    }
    if (error.status === 401) return "Google sign-in could not be verified. Please try again.";
    return error.message || "Google sign-in failed. Please try again.";
  }
  return error instanceof Error ? error.message : "Google sign-in failed. Please try again.";
}

/**
 * "Continue with Google" using Google Identity Services (popup).
 *
 * Google's own button is rendered invisibly on top of our styled button, so the
 * click opens the official Google account popup while keeping the app's look.
 * The returned ID token goes to Flask via `loginWithGoogle` (POST /api/auth/google);
 * there is deliberately no demo-auth fallback for a failed Google sign-in.
 */
export function GoogleSignInButton({ label = "Continue with Google" }: GoogleSignInButtonProps) {
  const { loginWithGoogle } = useAuth();
  const clientId = GOOGLE_CLIENT_ID;
  const configured = Boolean(clientId) && !clientId!.startsWith("your_");

  const overlayRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef(loginWithGoogle);
  loginRef.current = loginWithGoogle;

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then((api) => {
        if (cancelled || !overlayRef.current) return;
        api.initialize({
          client_id: clientId!,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async (response) => {
            if (!response.credential) {
              setError("Google didn't return a sign-in credential. Please try again.");
              return;
            }
            setBusy(true);
            setError(null);
            try {
              await loginRef.current(response.credential);
              // The login/register pages redirect once the user is signed in.
            } catch (err) {
              setError(messageFor(err));
            } finally {
              setBusy(false);
            }
          },
        });
        const width = Math.min(400, Math.max(200, wrapperRef.current?.offsetWidth ?? 320));
        overlayRef.current.innerHTML = "";
        api.renderButton(overlayRef.current, {
          type: "standard",
          size: "large",
          width,
          text: "continue_with",
        });
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load Google sign-in");
      });
    return () => {
      cancelled = true;
    };
  }, [configured, clientId]);

  const disabled = !configured || !ready || busy;

  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-busy={busy}
          tabIndex={-1}
          className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:border-primary hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleG />
          {busy ? "Signing in with Google…" : configured && !ready && !error ? "Loading Google…" : label}
        </button>
        {configured && (
          <div
            ref={overlayRef}
            aria-label={label}
            className={`absolute inset-0 overflow-hidden opacity-0 ${
              ready && !busy ? "" : "pointer-events-none"
            } [&_iframe]:!h-full [&_iframe]:!w-full [&>div]:h-full`}
          />
        )}
      </div>
      {!configured && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          Google sign-in isn't configured: the Google Client ID (VITE_GOOGLE_CLIENT_ID) is missing.
          Please use email and password for now.
        </p>
      )}
      {configured && error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
