/** Small shared badges so severity and status read the same on every page. */
import type { ReportStatus, Severity } from "@/services/api";
import { STATUS_LABELS } from "@/services/api";

const severityStyles: Record<Severity, string> = {
  LOW: "bg-secondary text-secondary-foreground",
  MEDIUM: "bg-primary/10 text-primary",
  HIGH: "bg-accent/20 text-accent-foreground",
  CRITICAL: "bg-destructive/15 text-destructive",
};

const statusStyles: Record<ReportStatus, string> = {
  NEW: "bg-primary/10 text-primary",
  PENDING_VERIFICATION: "bg-secondary text-secondary-foreground",
  VERIFIED: "bg-secondary text-secondary-foreground",
  ASSIGNED: "bg-accent/20 text-accent-foreground",
  IN_PROGRESS: "bg-accent/20 text-accent-foreground",
  RESOLVED: "bg-primary/15 text-primary",
  REJECTED: "bg-destructive/15 text-destructive",
};

const base =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide";

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`${base} ${severityStyles[severity]}`}>{severity}</span>;
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  return <span className={`${base} ${statusStyles[status]}`}>{STATUS_LABELS[status]}</span>;
}
