/**
 * Admin reports table: a real table on wide screens, cards on phones.
 * Data (including pagination) always comes from GET /api/admin/reports.
 */
import { Link } from "@tanstack/react-router";

import { SeverityBadge, StatusBadge } from "@/components/ReportBadges";
import { ISSUE_TYPE_LABELS, type DrainageReport } from "@/services/api";

function shortDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ViewLink({ id }: { id: number }) {
  return (
    <Link
      to="/admin/reports/$id"
      params={{ id: String(id) }}
      className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
    >
      View
    </Link>
  );
}

export function AdminReportsTable({ reports }: { reports: DrainageReport[] }) {
  return (
    <>
      {/* Wide screens: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                ID
              </th>
              <th scope="col" className="px-4 py-3">
                Issue
              </th>
              <th scope="col" className="px-4 py-3">
                Severity
              </th>
              <th scope="col" className="px-4 py-3">
                Citizen
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Date
              </th>
              <th scope="col" className="px-4 py-3">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id} className="border-t border-border">
                <td className="px-4 py-3 font-semibold">#{report.id}</td>
                <td className="px-4 py-3">
                  {ISSUE_TYPE_LABELS[report.issue_type] ?? report.issue_type}
                </td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={report.severity} />
                </td>
                <td className="px-4 py-3">{report.reporter?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={report.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{shortDate(report.created_at)}</td>
                <td className="px-4 py-3">
                  <ViewLink id={report.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: cards */}
      <ul className="grid gap-3 md:hidden">
        {reports.map((report) => (
          <li key={report.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  #{report.id} · {shortDate(report.created_at)}
                </p>
                <h3 className="mt-1 text-sm font-semibold">
                  {ISSUE_TYPE_LABELS[report.issue_type] ?? report.issue_type}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{report.reporter?.name ?? "—"}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <SeverityBadge severity={report.severity} />
                <StatusBadge status={report.status} />
              </div>
            </div>
            <div className="mt-3">
              <ViewLink id={report.id} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
