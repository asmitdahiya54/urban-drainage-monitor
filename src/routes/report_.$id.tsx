import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { StaticLocationMap } from "@/components/map/StaticLocationMap";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SeverityBadge, StatusBadge } from "@/components/ReportBadges";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { StatusTimeline } from "@/components/StatusTimeline";
import {
  ApiError,
  ISSUE_TYPE_LABELS,
  STATUS_LABELS,
  reportsApi,
  type DrainageReport,
} from "@/services/api";

export const Route = createFileRoute("/report_/$id")({
  head: () => ({
    meta: [
      { title: "Report Details | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Full details of a drainage report: issue type, severity, status history and the exact location on the map.",
      },
      { property: "og:title", content: "Report Details | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Track what happened to a drainage report you submitted.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <ReportDetailsPage />
    </ProtectedRoute>
  ),
});

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function ReportDetailsPage() {
  const { id } = useParams({ from: "/report_/$id" });
  const [report, setReport] = useState<DrainageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportsApi
      .get(id)
      .then(({ report: fetched }) => {
        if (!cancelled) setReport(fetched);
      })
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 404) setError("Report not found.");
        else if (caught instanceof ApiError && caught.status === 403)
          setError("You can only view your own reports.");
        else setError(caught instanceof ApiError ? caught.message : "Could not load this report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:py-16">
        <Link to="/reports" className="text-sm font-medium text-primary hover:underline">
          ← Back to my reports
        </Link>

        {loading && <p className="mt-8 text-sm text-muted-foreground">Loading report…</p>}

        {error && !loading && (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
            <h1 className="text-xl font-bold text-destructive">{error}</h1>
            <Link to="/reports" className="mt-3 inline-block text-sm font-medium text-primary">
              View my reports
            </Link>
          </div>
        )}

        {report && !loading && (
          <>
            <p className="mt-6 text-sm font-medium uppercase tracking-wide text-primary">
              Report #{report.id}
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {ISSUE_TYPE_LABELS[report.issue_type] ?? report.issue_type}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={report.severity} />
              <StatusBadge status={report.status} />
            </div>

            <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {report.description}
            </p>

            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { label: "Latitude", value: report.latitude },
                { label: "Longitude", value: report.longitude },
                { label: "Reported on", value: formatDate(report.created_at) },
                { label: "Last updated", value: formatDate(report.updated_at) },
                { label: "Resolved on", value: formatDate(report.resolved_at) },
                { label: "Reported by", value: report.reporter?.name ?? "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{String(item.value)}</dd>
                </div>
              ))}
            </dl>

            <h2 className="mt-10 text-lg font-semibold">Location</h2>
            <div className="mt-3">
              <StaticLocationMap latitude={report.latitude} longitude={report.longitude} />
            </div>

            <h2 className="mt-10 text-lg font-semibold">Status history</h2>
            <div className="mt-4">
              <StatusTimeline entries={report.status_history ?? []} />
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
