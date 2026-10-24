import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SeverityBadge, StatusBadge } from "@/components/ReportBadges";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { StatusTimeline } from "@/components/StatusTimeline";
import { StaticLocationMap } from "@/components/map/StaticLocationMap";
import {
  ApiError,
  adminApi,
  ISSUE_TYPE_LABELS,
  STATUS_LABELS,
  type DrainageReport,
  type ReportStatus,
} from "@/services/api";

export const Route = createFileRoute("/admin_/reports/$id")({
  head: () => ({
    meta: [
      { title: "Manage Report | Urban Drainage Monitor Admin" },
      {
        name: "description",
        content:
          "Administrator view of a single drainage report: citizen details, location map, status timeline and status updates.",
      },
      { property: "og:title", content: "Manage Report | Urban Drainage Monitor Admin" },
      {
        property: "og:description",
        content: "Review a citizen drainage report and move it through the workflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute role="admin">
      <AdminReportPage />
    </ProtectedRoute>
  ),
});

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function AdminReportPage() {
  const { id } = useParams({ from: "/admin_/reports/$id" });
  const reportId = Number(id);

  const [report, setReport] = useState<DrainageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newStatus, setNewStatus] = useState<ReportStatus | "">("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { report: fetched } = await adminApi.report(reportId);
      setReport(fetched);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "This report could not be loaded right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!newStatus || saving) return;
    setSaving(true);
    setUpdateError(null);
    setSuccess(null);
    try {
      const body: { status: ReportStatus; comment?: string } = { status: newStatus };
      if (comment.trim()) body.comment = comment.trim();
      const result = await adminApi.updateStatus(reportId, body);
      // The API returns the fresh report, so the database stays the single source of truth.
      setReport(result.report);
      setSuccess(result.message);
      setNewStatus("");
      setComment("");
    } catch (caught) {
      setUpdateError(
        caught instanceof ApiError ? caught.message : "The status could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  const nextOptions = report?.allowed_next_statuses ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:py-16">
        <Link to="/admin" className="text-sm font-medium text-primary hover:underline">
          ← Back to admin dashboard
        </Link>

        {loading && <p className="mt-8 text-sm text-muted-foreground">Loading report…</p>}
        {error && !loading && (
          <p
            role="alert"
            className="mt-8 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {report && !loading && !error && (
          <>
            <p className="mt-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Report #{report.id}
            </p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
              {ISSUE_TYPE_LABELS[report.issue_type] ?? report.issue_type}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={report.severity} />
              <StatusBadge status={report.status} />
            </div>
            <p className="mt-4 max-w-2xl">{report.description}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Detail label="Citizen" value={report.reporter?.name ?? "—"} />
              <Detail label="Citizen email" value={report.reporter?.email ?? "—"} />
              <Detail label="Reported on" value={formatDateTime(report.created_at)} />
              <Detail label="Last updated" value={formatDateTime(report.updated_at)} />
              <Detail label="Resolved on" value={formatDateTime(report.resolved_at)} />
              <Detail
                label="Coordinates"
                value={`${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`}
              />
            </div>

            <h2 className="mt-10 text-lg font-semibold">Location</h2>
            <div className="mt-3">
              <StaticLocationMap latitude={report.latitude} longitude={report.longitude} />
            </div>

            <h2 className="mt-10 text-lg font-semibold">Update status</h2>
            <form
              onSubmit={handleUpdate}
              className="mt-3 grid gap-4 rounded-xl border border-border bg-card p-5"
            >
              <p className="text-sm">
                Current status: <strong>{STATUS_LABELS[report.status]}</strong>
              </p>

              {success && (
                <p
                  role="status"
                  className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-primary"
                >
                  {success}
                </p>
              )}
              {updateError && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                >
                  {updateError}
                </p>
              )}

              <label className="text-sm font-medium">
                New status
                <select
                  aria-label="New status"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={newStatus}
                  disabled={saving || nextOptions.length === 0}
                  onChange={(event) => setNewStatus(event.target.value as ReportStatus | "")}
                >
                  <option value="">Select a status…</option>
                  {nextOptions.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Comment
                <textarea
                  aria-label="Comment"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={comment}
                  disabled={saving}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Optional note for the audit trail"
                />
              </label>

              {nextOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This report is {STATUS_LABELS[report.status].toLowerCase()} — no further status
                  changes are possible.
                </p>
              ) : (
                <button
                  type="submit"
                  disabled={saving || !newStatus}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {saving ? "Updating…" : "Update status"}
                </button>
              )}
            </form>

            <h2 className="mt-10 text-lg font-semibold">Status timeline</h2>
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
