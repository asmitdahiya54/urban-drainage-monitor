/**
 * Shared pieces for "my reports": the statistics row and the report cards.
 * Used by both the dashboard and the My Reports page.
 */
import { Link } from "@tanstack/react-router";

import { SeverityBadge, StatusBadge } from "@/components/ReportBadges";
import { ISSUE_TYPE_LABELS, type DrainageReport } from "@/services/api";

export function reportStats(reports: DrainageReport[]) {
  return {
    total: reports.length,
    new: reports.filter((r) => r.status === "NEW").length,
    inProgress: reports.filter((r) =>
      ["ASSIGNED", "IN_PROGRESS", "VERIFIED", "PENDING_VERIFICATION"].includes(r.status),
    ).length,
    resolved: reports.filter((r) => r.status === "RESOLVED").length,
  };
}

export function ReportStats({ reports }: { reports: DrainageReport[] }) {
  const stats = reportStats(reports);
  const items = [
    { label: "Total reports", value: stats.total },
    { label: "New", value: stats.new },
    { label: "In progress", value: stats.inProgress },
    { label: "Resolved", value: stats.resolved },
  ];
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-card p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-1 text-2xl font-bold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReportCard({ report }: { report: DrainageReport }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Report #{report.id}
          </p>
          <h3 className="mt-1 text-base font-semibold">
            {ISSUE_TYPE_LABELS[report.issue_type] ?? report.issue_type}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={report.severity} />
          <StatusBadge status={report.status} />
        </div>
      </div>

      <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Date: </dt>
          <dd className="inline">
            {report.created_at ? new Date(report.created_at).toLocaleDateString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Location: </dt>
          <dd className="inline">
            {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
          </dd>
        </div>
      </dl>

      <Link
        to="/report/$id"
        params={{ id: String(report.id) }}
        className="mt-4 inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
      >
        View
      </Link>
    </li>
  );
}

export function ReportList({ reports }: { reports: DrainageReport[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">You have not submitted any reports yet.</p>
        <Link
          to="/report"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Report an issue
        </Link>
      </div>
    );
  }
  return (
    <ul className="grid gap-4">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </ul>
  );
}
