/** Live server connection badge, based only on GET /api/health. */
import { useEffect, useState } from "react";

import { checkBackendHealth, type HealthState } from "@/services/api";

const STYLES: Record<HealthState, { label: string; dot: string }> = {
  checking: { label: "Checking server…", dot: "bg-muted-foreground animate-pulse" },
  connected: { label: "Server connected", dot: "bg-emerald-500" },
  degraded: { label: "Server up · database unavailable", dot: "bg-amber-500" },
  disconnected: { label: "Server disconnected", dot: "bg-destructive" },
};

let cached: Promise<{ state: HealthState; message: string }> | null = null;

export function useBackendHealth() {
  const [state, setState] = useState<HealthState>("checking");
  const [message, setMessage] = useState("Checking the server connection…");
  useEffect(() => {
    let alive = true;
    cached ??= checkBackendHealth();
    cached.then((r) => {
      if (!alive) return;
      setState(r.state);
      setMessage(r.message);
      if (r.state !== "connected") cached = null; // re-check on next page
    });
    return () => {
      alive = false;
    };
  }, []);
  return { state, message };
}

export function BackendStatus({ className = "" }: { className?: string }) {
  const { state, message } = useBackendHealth();
  const s = STYLES[state];
  return (
    <span
      role="status"
      title={message}
      className={`inline-flex items-center gap-2 text-xs ${className}`}
    >
      <span aria-hidden className={`inline-block size-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** Warning banner shown only when the server is not fully connected. */
export function BackendWarning({ demoNote }: { demoNote: string }) {
  const { state, message } = useBackendHealth();
  if (state === "connected" || state === "checking") return null;
  return (
    <p
      role="alert"
      className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground"
    >
      <span className="font-semibold text-amber-500">{message}.</span> {demoNote}
    </p>
  );
}
