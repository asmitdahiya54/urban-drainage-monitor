/**
 * DEMO issue management — browser-only admin overrides for sample issues and
 * locally saved demo reports. Original records are never rewritten; status
 * changes and notes are stored separately and merged on read.
 */
import { SAMPLE_ISSUES, type MapIssue, type MapIssueStatus } from "@/data/sampleIssues";
import { listDemoReports } from "@/lib/demoReports";

export type IssueWorkflowStatus =
  "REPORTED" | "UNDER_REVIEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

export const ISSUE_STATUS_LABELS: Record<IssueWorkflowStatus, string> = {
  REPORTED: "Reported",
  UNDER_REVIEW: "Under Review",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};
export const ISSUE_STATUS_ORDER: IssueWorkflowStatus[] = [
  "REPORTED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];
export const ISSUE_STATUS_COLORS: Record<IssueWorkflowStatus, string> = {
  REPORTED: "#38bdf8",
  UNDER_REVIEW: "#eab308",
  IN_PROGRESS: "#a855f7",
  RESOLVED: "#22c55e",
  REJECTED: "#94a3b8",
};

/** Allowed next steps. Resolved and Rejected are final. */
export const ISSUE_TRANSITIONS: Record<IssueWorkflowStatus, IssueWorkflowStatus[]> = {
  REPORTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
  REJECTED: [],
};

export type AdminNote = { at: string; text: string };
export type IssueEvent = { at: string; from: IssueWorkflowStatus; to: IssueWorkflowStatus };
type Override = {
  status: IssueWorkflowStatus;
  notes: AdminNote[];
  history: IssueEvent[];
  updated_at: string;
};

export type ManagedIssue = MapIssue & {
  workflow: IssueWorkflowStatus;
  citizen: string | null;
  notes: AdminNote[];
  history: IssueEvent[];
  updated_at: string;
};

const KEY = "udm.demo_issue_admin";

function readOverrides(): Record<string, Override> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, Override> = {};
    for (const [id, v] of Object.entries(parsed as Record<string, Override>)) {
      if (
        v &&
        ISSUE_STATUS_ORDER.includes(v.status) &&
        Array.isArray(v.notes) &&
        Array.isArray(v.history)
      )
        out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function baseWorkflow(s: MapIssueStatus): IssueWorkflowStatus {
  return s === "RESOLVED" ? "RESOLVED" : s === "IN_PROGRESS" ? "IN_PROGRESS" : "REPORTED";
}

export function toMapStatus(w: IssueWorkflowStatus): MapIssueStatus | null {
  if (w === "REJECTED") return null;
  if (w === "RESOLVED") return "RESOLVED";
  if (w === "IN_PROGRESS") return "IN_PROGRESS";
  return "OPEN";
}

/** Sample issues + browser-saved demo reports, with admin overrides applied. */
export function loadManagedIssues(): ManagedIssue[] {
  const overrides = readOverrides();
  const demo: (MapIssue & { citizen: string | null })[] = listDemoReports().map((r) => ({
    id: r.reference,
    title: r.title,
    category: r.category,
    severity: (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(r.severity)
      ? r.severity
      : "MEDIUM") as MapIssue["severity"],
    status: "OPEN",
    location: r.landmark || `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`,
    description: r.description,
    reported_at: r.created_at,
    latitude: r.latitude,
    longitude: r.longitude,
    source: "local-demo",
    citizen: r.owner_email || null,
  }));
  const samples = SAMPLE_ISSUES.map((i) => ({ ...i, citizen: "Sample citizen (fictional)" }));
  const seen = new Set<string>();
  return [...demo, ...samples]
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .map((i) => {
      const o = overrides[i.id];
      return {
        ...i,
        workflow: o?.status ?? baseWorkflow(i.status),
        notes: o?.notes ?? [],
        history: o?.history ?? [],
        updated_at: o?.updated_at ?? i.reported_at,
      };
    });
}

function write(id: string, o: Override) {
  const all = readOverrides();
  all[id] = o;
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function changeIssueStatus(issue: ManagedIssue, to: IssueWorkflowStatus) {
  if (!ISSUE_TRANSITIONS[issue.workflow].includes(to))
    throw new Error(
      `Cannot move from ${ISSUE_STATUS_LABELS[issue.workflow]} to ${ISSUE_STATUS_LABELS[to]}.`,
    );
  const at = new Date().toISOString();
  write(issue.id, {
    status: to,
    notes: issue.notes,
    history: [...issue.history, { at, from: issue.workflow, to }],
    updated_at: at,
  });
}

export function addIssueNote(issue: ManagedIssue, text: string) {
  const at = new Date().toISOString();
  write(issue.id, {
    status: issue.workflow,
    notes: [...issue.notes, { at, text }],
    history: issue.history,
    updated_at: at,
  });
}

/** Map-facing status for an issue id, honouring admin overrides. */
export function adminStatusOverrides(): Record<string, IssueWorkflowStatus> {
  return Object.fromEntries(Object.entries(readOverrides()).map(([k, v]) => [k, v.status]));
}
