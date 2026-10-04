/** Filter bar for the admin reports table. Every change re-queries the API. */
import { ISSUE_TYPES, SEVERITIES, STATUS_LABELS, type ReportStatus } from "@/services/api";

const STATUS_VALUES: ReportStatus[] = [
  "NEW",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];

export type AdminFilterState = {
  status: string;
  severity: string;
  issue_type: string;
  search: string;
};

export const EMPTY_FILTERS: AdminFilterState = {
  status: "ALL",
  severity: "ALL",
  issue_type: "ALL",
  search: "",
};

const selectClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export function AdminFilters({
  value,
  onChange,
}: {
  value: AdminFilterState;
  onChange: (next: AdminFilterState) => void;
}) {
  function set<K extends keyof AdminFilterState>(key: K, next: AdminFilterState[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Status
        <select
          className={`mt-1 ${selectClass}`}
          value={value.status}
          onChange={(event) => set("status", event.target.value)}
        >
          <option value="ALL">All</option>
          {STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Severity
        <select
          className={`mt-1 ${selectClass}`}
          value={value.severity}
          onChange={(event) => set("severity", event.target.value)}
        >
          <option value="ALL">All</option>
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Issue type
        <select
          className={`mt-1 ${selectClass}`}
          value={value.issue_type}
          onChange={(event) => set("issue_type", event.target.value)}
        >
          <option value="ALL">All</option>
          {ISSUE_TYPES.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Search
        <input
          type="search"
          placeholder="Description or citizen"
          className={`mt-1 ${selectClass}`}
          value={value.search}
          onChange={(event) => set("search", event.target.value)}
        />
      </label>
    </div>
  );
}
