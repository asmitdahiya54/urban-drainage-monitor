/**
 * Vertical status timeline shared by the citizen and admin report pages.
 * The data always comes from the database (report_status_history).
 */
import { STATUS_LABELS, type StatusHistoryEntry } from "@/services/api";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function StatusTimeline({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No status changes yet.</p>;
  }

  return (
    <ol className="relative ml-2 border-l border-border pl-6">
      {entries.map((entry, index) => (
        <li key={entry.id} className={index === entries.length - 1 ? "" : "pb-6"}>
          <span
            aria-hidden="true"
            className={`absolute -left-[7px] mt-1.5 size-3.5 rounded-full border-2 border-background ${
              index === entries.length - 1 ? "bg-primary" : "bg-muted-foreground"
            }`}
          />
          <p className="text-sm font-semibold uppercase tracking-wide">
            {STATUS_LABELS[entry.new_status]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(entry.changed_at)}
            {entry.old_status ? ` · from ${STATUS_LABELS[entry.old_status]}` : ""}
            {entry.changed_by_name ? ` · by ${entry.changed_by_name}` : ""}
          </p>
          {entry.comment && <p className="mt-1 text-sm">{entry.comment}</p>}
        </li>
      ))}
    </ol>
  );
}
