/**
 * Admin dashboard for FRONTEND DEMO mode (demo admin session).
 * Manages sample + browser-saved demo issues and maintenance work. Nothing is
 * sent to a server.
 */
import { Link } from "@tanstack/react-router";
import { BarChart3, ClipboardList, Search, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MaintenanceManager } from "@/components/maintenance/MaintenanceManager";
import { MAP_CATEGORIES } from "@/data/sampleIssues";
import {
  ISSUE_STATUS_COLORS,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUS_ORDER,
  ISSUE_TRANSITIONS,
  addIssueNote,
  changeIssueStatus,
  loadManagedIssues,
  type IssueWorkflowStatus,
  type ManagedIssue,
} from "@/lib/demoIssueAdmin";
import {
  WORK_STATUS_COLORS,
  WORK_STATUS_LABELS,
  WORK_STATUS_ORDER,
  loadWork,
  type WorkRecord,
} from "@/lib/maintenance";

type Tab = "overview" | "reports" | "maintenance";
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString() : "—");

function Badge({ status }: { status: IssueWorkflowStatus }) {
  const c = ISSUE_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ borderColor: c, color: c }}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: c }} />
      {ISSUE_STATUS_LABELS[status]}
    </span>
  );
}

function Bars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="text-xs">
            <div className="flex justify-between">
              <span>{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-secondary">
              <div
                className="h-2 rounded-full"
                style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DemoAdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [issues, setIssues] = useState<ManagedIssue[] | null>(null);
  const [work, setWork] = useState<WorkRecord[]>([]);
  const refresh = () => {
    setIssues(loadManagedIssues());
    setWork(loadWork());
  };
  useEffect(refresh, []);
  useEffect(() => {
    if (tab !== "maintenance") refresh();
  }, [tab]);

  const all = issues ?? [];
  const count = (s: IssueWorkflowStatus) => all.filter((i) => i.workflow === s).length;
  const wcount = (s: WorkRecord["status"]) => work.filter((w) => w.status === s).length;

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Overview & analytics", icon: BarChart3 },
    { id: "reports", label: "Report management", icon: ClipboardList },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-5 sm:py-14">
      <p className="text-sm font-medium uppercase tracking-wide text-primary">
        Administration · demo mode
      </p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Admin dashboard</h1>
      <p className="mt-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-amber-500">Demo admin:</span> these are sample and
        browser-saved demo records. Changes are stored only in this browser — no real municipal or
        server action happens.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto lg:flex-col">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${tab === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
          <Link
            to="/map"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold hover:border-primary/50"
          >
            Issues map
          </Link>
        </nav>

        <div className="min-w-0">
          {!issues ? (
            <p className="text-sm text-muted-foreground">Loading dashboard…</p>
          ) : tab === "overview" ? (
            <Overview
              stats={[
                { label: "Total issues", value: all.length },
                { label: "Pending (reported)", value: count("REPORTED") },
                { label: "Under review", value: count("UNDER_REVIEW") },
                { label: "Resolved issues", value: count("RESOLVED") },
                { label: "Total work", value: work.length },
                ...WORK_STATUS_ORDER.map((s) => ({
                  label: `${WORK_STATUS_LABELS[s]} work`,
                  value: wcount(s),
                })),
              ]}
              issues={all}
              work={work}
            />
          ) : tab === "reports" ? (
            <ReportManagement issues={all} onChanged={refresh} />
          ) : (
            <MaintenanceManager embedded />
          )}
        </div>
      </div>
    </div>
  );
}

function Overview({
  stats,
  issues,
  work,
}: {
  stats: { label: string; value: number }[];
  issues: ManagedIssue[];
  work: WorkRecord[];
}) {
  const recentIssues = [...issues]
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at))
    .slice(0, 5);
  const recentWork = [...work].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.label}
            </dt>
            <dd className="mt-1 text-2xl font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-4 md:grid-cols-2">
        <Bars
          title="Issues by category"
          rows={MAP_CATEGORIES.map((c) => ({
            label: c,
            value: issues.filter((i) => i.category === c).length,
            color: "var(--color-primary)",
          }))}
        />
        <Bars
          title="Issues by severity"
          rows={SEVERITIES.map((s) => ({
            label: cap(s),
            value: issues.filter((i) => i.severity === s).length,
            color: SEV_COLORS[s]!,
          }))}
        />
        <Bars
          title="Issue status"
          rows={ISSUE_STATUS_ORDER.map((s) => ({
            label: ISSUE_STATUS_LABELS[s],
            value: issues.filter((i) => i.workflow === s).length,
            color: ISSUE_STATUS_COLORS[s],
          }))}
        />
        <Bars
          title="Maintenance status"
          rows={WORK_STATUS_ORDER.map((s) => ({
            label: WORK_STATUS_LABELS[s],
            value: work.filter((w) => w.status === s).length,
            color: WORK_STATUS_COLORS[s],
          }))}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Recent reports</h3>
          <ul className="mt-2 divide-y divide-border text-sm">
            {recentIssues.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{i.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {i.id} · {fmt(i.reported_at)}
                  </span>
                </span>
                <Badge status={i.workflow} />
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Recent maintenance updates</h3>
          <ul className="mt-2 divide-y divide-border text-sm">
            {recentWork.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{w.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.id} · {fmt(w.updated_at)}
                  </span>
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: WORK_STATUS_COLORS[w.status] }}
                >
                  {WORK_STATUS_LABELS[w.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ReportManagement({
  issues,
  onChanged,
}: {
  issues: ManagedIssue[];
  onChanged: () => void;
}) {
  const [category, setCategory] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter(
      (i) =>
        (category === "ALL" || i.category === category) &&
        (severity === "ALL" || i.severity === severity) &&
        (status === "ALL" || i.workflow === status) &&
        (!q || [i.id, i.title, i.location].some((v) => v.toLowerCase().includes(q))),
    );
  }, [issues, category, severity, status, query]);
  const open = issues.find((i) => i.id === openId) ?? null;
  const sel = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  return (
    <div>
      <h2 className="text-2xl font-bold">Report management</h2>
      <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-muted-foreground">Search</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 100))}
              placeholder="ID, title or location"
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-muted-foreground">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={sel}>
            <option value="ALL">All</option>
            {MAP_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-muted-foreground">Severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={sel}>
            <option value="ALL">All</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {cap(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-muted-foreground">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
            <option value="ALL">All</option>
            {ISSUE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {ISSUE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{filtered.length} reports</p>
      {filtered.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No reports match these filters.
        </div>
      ) : (
        <>
          <div className="mt-3 hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                <tr>
                  {[
                    "ID",
                    "Title",
                    "Category",
                    "Severity",
                    "Location",
                    "Citizen",
                    "Reported",
                    "Status",
                    "",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((i) => (
                  <tr key={i.id} className="bg-card">
                    <td className="px-3 py-2 font-mono text-xs">{i.id}</td>
                    <td className="px-3 py-2">{i.title}</td>
                    <td className="px-3 py-2">{i.category}</td>
                    <td
                      className="px-3 py-2 font-semibold"
                      style={{ color: SEV_COLORS[i.severity] }}
                    >
                      {cap(i.severity)}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2">{i.location}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2 text-xs">{i.citizen ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(i.reported_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <Badge status={i.workflow} />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(i.id)}
                        className="font-semibold text-primary hover:underline"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-3 md:hidden">
            {filtered.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(i.id)}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{i.id}</span>
                    <Badge status={i.workflow} />
                  </div>
                  <p className="mt-1 font-semibold">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.category} ·{" "}
                    <span style={{ color: SEV_COLORS[i.severity] }}>{cap(i.severity)}</span> ·{" "}
                    {i.location}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {open && <IssueDialog issue={open} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </div>
  );
}

function IssueDialog({
  issue,
  onClose,
  onChanged,
}: {
  issue: ManagedIssue;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmTo, setConfirmTo] = useState<IssueWorkflowStatus | null>(null);
  const options = ISSUE_TRANSITIONS[issue.workflow];

  function apply(to: IssueWorkflowStatus) {
    try {
      changeIssueStatus(issue, to);
      setMsg({ ok: true, text: `Status changed to ${ISSUE_STATUS_LABELS[to]} (demo).` });
      setConfirmTo(null);
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not update status." });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report ${issue.id}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="rounded-full border border-amber-500/50 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
              {issue.source === "sample" ? "SAMPLE DATA" : "CITIZEN DEMO REPORT"}
            </span>
            <h2 className="mt-2 text-xl font-semibold">{issue.title}</h2>
            <p className="font-mono text-xs text-muted-foreground">{issue.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 hover:bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd>
              <Badge status={issue.workflow} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Severity</dt>
            <dd className="font-semibold" style={{ color: SEV_COLORS[issue.severity] }}>
              {cap(issue.severity)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Category</dt>
            <dd>{issue.category}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Citizen</dt>
            <dd className="truncate">{issue.citizen ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Location</dt>
            <dd>{issue.location}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Reported</dt>
            <dd>{fmt(issue.reported_at)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-line">{issue.description}</dd>
          </div>
        </dl>

        {msg && (
          <p
            role="status"
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${msg.ok ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
          >
            {msg.text}
          </p>
        )}

        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Update status (demo)
          </p>
          {options.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {ISSUE_STATUS_LABELS[issue.workflow]} is a final status.
            </p>
          ) : confirmTo ? (
            <div className="mt-2 text-sm">
              <p>
                Change status from <b>{ISSUE_STATUS_LABELS[issue.workflow]}</b> to{" "}
                <b>{ISSUE_STATUS_LABELS[confirmTo]}</b>?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => apply(confirmTo)}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmTo(null)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map((to) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => setConfirmTo(to)}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-secondary"
                  style={{ borderColor: ISSUE_STATUS_COLORS[to] }}
                >
                  Move to {ISSUE_STATUS_LABELS[to]}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const t = note.trim();
            if (t.length < 3)
              return setMsg({ ok: false, text: "Note must be at least 3 characters." });
            addIssueNote(issue, t);
            setNote("");
            setMsg({ ok: true, text: "Admin note added (demo)." });
            onChanged();
          }}
        >
          <label className="block text-sm font-medium">
            Admin note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary"
          >
            Add note
          </button>
        </form>

        {(issue.notes.length > 0 || issue.history.length > 0) && (
          <ol className="mt-5 space-y-2 border-l border-border pl-4 text-sm">
            {[
              ...issue.history.map((h) => ({
                at: h.at,
                text: `${ISSUE_STATUS_LABELS[h.from]} → ${ISSUE_STATUS_LABELS[h.to]}`,
              })),
              ...issue.notes.map((n) => ({ at: n.at, text: `Note: ${n.text}` })),
            ]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((e, i) => (
                <li key={i}>
                  <p>{e.text}</p>
                  <p className="text-xs text-muted-foreground">{fmt(e.at)}</p>
                </li>
              ))}
          </ol>
        )}
      </div>
    </div>
  );
}
