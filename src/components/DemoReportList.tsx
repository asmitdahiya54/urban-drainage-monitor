/** Lists browser-saved demo reports for demo sessions (no server involved). */
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { adminStatusOverrides, ISSUE_STATUS_LABELS } from "@/lib/demoIssueAdmin";
import { listDemoReports, type DemoReport } from "@/lib/demoReports";

export function DemoReportList({ limit }: { limit?: number }) {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<DemoReport[] | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    setItems(listDemoReports(isAdmin ? undefined : user?.email).reverse());
    const o = adminStatusOverrides();
    setStatus(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ISSUE_STATUS_LABELS[v]])));
  }, [user?.email, isAdmin]);

  if (!items)
    return <p className="mt-4 text-sm text-muted-foreground">Loading your demo reports…</p>;
  const shown = limit ? items.slice(0, limit) : items;

  return (
    <div className="mt-4">
      <p className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-amber-500">Demo mode:</span> showing reports saved in
        this browser only. They are not sent to the city.
      </p>
      {shown.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <p>No demo reports yet.</p>
          <Link
            to="/report"
            className="mt-3 inline-block font-semibold text-primary hover:underline"
          >
            Report your first issue
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((r) => (
            <li key={r.reference} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                <span className="rounded-full border border-primary/40 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {status[r.reference] ?? "Reported"}
                </span>
              </div>
              <p className="mt-1 font-semibold">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {r.category} · {r.severity.charAt(0) + r.severity.slice(1).toLowerCase()} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
      {limit && items.length > limit && (
        <Link
          to="/reports"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          View all {items.length} demo reports →
        </Link>
      )}
    </div>
  );
}
