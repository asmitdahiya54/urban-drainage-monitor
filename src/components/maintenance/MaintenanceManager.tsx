/** Maintenance tracker UI shared by /maintenance and the admin dashboard. */
import { CheckCircle2, Circle, Pencil, Plus, Search, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LocationPicker } from "@/components/map/LocationPicker";
import { useAuth } from "@/context/AuthContext";
import { SAMPLE_ISSUES } from "@/data/sampleIssues";
import { listDemoReports } from "@/lib/demoReports";
import {
  WORK_STATUS_COLORS,
  WORK_STATUS_LABELS,
  WORK_STATUS_ORDER,
  WORK_TYPES,
  loadWork,
  nextStatus,
  nextWorkId,
  saveWork,
  type WorkRecord,
  type WorkStatus,
  type WorkType,
} from "@/lib/maintenance";

const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString() : "—");
const toLocalInput = (iso: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-destructive";

function StatusBadge({ status }: { status: WorkStatus }) {
  const c = WORK_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ borderColor: c, color: c }}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: c }} />
      {WORK_STATUS_LABELS[status]}
    </span>
  );
}

function SourceTag({ source }: { source: WorkRecord["source"] }) {
  return (
    <span className="rounded-full border border-amber-500/50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-500">
      {source === "sample" ? "SAMPLE DATA" : "ADMIN DEMO RECORD"}
    </span>
  );
}

export function MaintenanceManager({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState<WorkRecord[] | null>(null);
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [location, setLocation] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkRecord | "new" | null>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => setRecords(loadWork()), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const all = records ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const loc = location.trim().toLowerCase();
    return all.filter(
      (r) =>
        (type === "ALL" || r.type === type) &&
        (status === "ALL" || r.status === status) &&
        (!loc || r.location.toLowerCase().includes(loc)) &&
        (!q ||
          [r.id, r.title, r.team, r.related_issue_id ?? ""].some((v) =>
            v.toLowerCase().includes(q),
          )),
    );
  }, [all, type, status, location, query]);

  const stats = {
    total: all.length,
    SCHEDULED: all.filter((r) => r.status === "SCHEDULED").length,
    IN_PROGRESS: all.filter((r) => r.status === "IN_PROGRESS").length,
    COMPLETED: all.filter((r) => r.status === "COMPLETED").length,
  };

  function persist(record: WorkRecord, message: string) {
    try {
      saveWork(record);
      setRecords(loadWork());
      setToast({ tone: "ok", text: message });
    } catch {
      setToast({
        tone: "err",
        text: "Could not save in this browser (storage may be full or blocked).",
      });
    }
  }

  const open = all.find((r) => r.id === openId) ?? null;
  const filtersActive = type !== "ALL" || status !== "ALL" || location || query;

  return (
    <div>
      <div
        className={embedded ? "" : "mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-5 sm:py-14"}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">Maintenance</p>
            {embedded ? (
              <h2 className="mt-1 text-2xl font-bold">Maintenance management</h2>
            ) : (
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Drainage Work Tracker</h1>
            )}
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Follow drainage cleaning, repair and construction work from scheduling to completion.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> New work order
            </button>
          )}
        </div>

        <p className="mt-4 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-amber-500">Demo data:</span> work orders are fictional
          sample records and admin demo entries saved in this browser. They are not real municipal
          work and the locations are not verified.
        </p>

        {toast && (
          <p
            role="status"
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${toast.tone === "ok" ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
          >
            {toast.text}
          </p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total work orders", value: stats.total, color: undefined },
            ...WORK_STATUS_ORDER.map((s) => ({
              label: WORK_STATUS_LABELS[s],
              value: stats[s],
              color: WORK_STATUS_COLORS[s],
            })),
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </dt>
              <dd
                className="mt-1 text-2xl font-bold"
                style={c.color ? { color: c.color } : undefined}
              >
                {records ? c.value : "…"}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value.slice(0, 100))}
                placeholder="ID, title, team, issue"
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Work type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">All</option>
              {WORK_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">All</option>
              {WORK_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {WORK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value.slice(0, 100))}
              placeholder="e.g. Sector 12"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setType("ALL");
                setStatus("ALL");
                setLocation("");
                setQuery("");
              }}
              className="justify-self-start text-sm font-semibold text-primary hover:underline sm:col-span-2 lg:col-span-4"
            >
              Clear all filters
            </button>
          )}
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          {records ? `${filtered.length} work orders` : "Loading work orders…"}
        </p>
        {records && filtered.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No work orders match these filters.
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className="block h-full w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} />
                    <SourceTag source={r.source} />
                  </div>
                  <h2 className="mt-2 font-semibold">{r.title}</h2>
                  <p className="font-mono text-xs text-muted-foreground">
                    {r.id} · {r.type}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{r.location}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.team} · due {fmt(r.expected_completion)}
                    {r.related_issue_id && ` · issue ${r.related_issue_id}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <WorkDetails
          record={open}
          isAdmin={isAdmin}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditing(open)}
          onAdvance={(note, resolveIssue) => {
            const next = nextStatus(open.status);
            if (!next) return;
            const now = new Date().toISOString();
            persist(
              {
                ...open,
                status: next,
                updated_at: now,
                completion_note: next === "COMPLETED" ? note : open.completion_note,
                issue_resolved:
                  next === "COMPLETED" ? resolveIssue : (open.issue_resolved ?? false),
                history: [
                  ...open.history,
                  {
                    at: now,
                    status: next,
                    note: note || `Status changed to ${WORK_STATUS_LABELS[next]}.`,
                  },
                ],
              },
              `${open.id} is now ${WORK_STATUS_LABELS[next]}.`,
            );
          }}
        />
      )}
      {editing && isAdmin && (
        <WorkForm
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(record, isNew) => {
            persist(record, isNew ? `Work order ${record.id} created.` : `${record.id} updated.`);
            setEditing(null);
            setOpenId(record.id);
          }}
        />
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-background/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 hover:bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function issueLabel(id: string | null) {
  if (!id) return null;
  const s = SAMPLE_ISSUES.find((i) => i.id === id);
  if (s) return `${s.title} (${s.location})`;
  const d = listDemoReports().find((r) => r.reference === id);
  return d ? `${d.title} (your demo report)` : id;
}

function WorkDetails({
  record,
  isAdmin,
  onClose,
  onEdit,
  onAdvance,
}: {
  record: WorkRecord;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAdvance: (note: string, resolveIssue: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [resolve, setResolve] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const next = nextStatus(record.status);
  const idx = WORK_STATUS_ORDER.indexOf(record.status);
  const steps = [
    { label: "Reported issue", done: Boolean(record.related_issue_id) },
    { label: "Work scheduled", done: true },
    { label: "Work in progress", done: idx >= 1 },
    { label: "Work completed", done: idx >= 2 },
    { label: "Issue resolved", done: Boolean(record.issue_resolved) },
  ];

  return (
    <Modal title={record.title} onClose={onClose}>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={record.status} />
        <SourceTag source={record.source} />
        <span className="font-mono text-xs text-muted-foreground">{record.id}</span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Work type</dt>
          <dd>{record.type}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Team / department</dt>
          <dd>{record.team}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Location</dt>
          <dd>
            {record.location}
            {record.latitude !== null &&
              record.longitude !== null &&
              ` · ${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Start</dt>
          <dd>{fmt(record.start_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Expected completion</dt>
          <dd>{fmt(record.expected_completion)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Last updated</dt>
          <dd>{fmt(record.updated_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Related issue</dt>
          <dd>
            {record.related_issue_id
              ? `${record.related_issue_id} — ${issueLabel(record.related_issue_id)}`
              : "None"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Description</dt>
          <dd className="whitespace-pre-line">{record.description}</dd>
        </div>
        {record.completion_note && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Completion note</dt>
            <dd>{record.completion_note}</dd>
          </div>
        )}
      </dl>
      {record.photos.length > 0 ? (
        <ul className="mt-4 grid grid-cols-3 gap-2">
          {record.photos.map((p, i) => (
            <li key={i}>
              <img
                src={p}
                alt={`Work photo ${i + 1}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No photos for this work order.</p>
      )}

      <h3 className="mt-6 text-sm font-semibold">Progress</h3>
      <ol className="mt-2 flex flex-wrap gap-x-2 gap-y-2 text-xs">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            {s.done ? (
              <CheckCircle2 className="size-4 text-primary" />
            ) : (
              <Circle className="size-4 text-muted-foreground" />
            )}
            <span className={s.done ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < steps.length - 1 && (
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
      {idx >= 2 && !record.issue_resolved && record.related_issue_id && (
        <p className="mt-2 text-xs text-muted-foreground">
          The related issue has not been confirmed as resolved yet.
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold">Timeline</h3>
      <ol className="mt-2 space-y-3 border-l border-border pl-4">
        {[...record.history].reverse().map((e, i) => (
          <li key={i} className="relative text-sm">
            <span
              className="absolute -left-[21px] top-1 size-2.5 rounded-full"
              style={{ backgroundColor: WORK_STATUS_COLORS[e.status] }}
            />
            <p className="font-medium">
              {WORK_STATUS_LABELS[e.status]}{" "}
              <span className="text-xs font-normal text-muted-foreground">· {fmt(e.at)}</span>
            </p>
            <p className="text-xs text-muted-foreground">{e.note}</p>
          </li>
        ))}
      </ol>

      {isAdmin && (
        <div className="mt-6 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Admin controls (demo)
          </p>
          {next ? (
            <>
              <label className="block text-sm font-medium">
                {next === "COMPLETED" ? "Completion note (required)" : "Update note (optional)"}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  rows={2}
                  aria-invalid={Boolean(noteError)}
                  className={inputClass}
                />
                {noteError && (
                  <span className="mt-1 block text-xs text-destructive">{noteError}</span>
                )}
              </label>
              {next === "COMPLETED" && record.related_issue_id && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={resolve}
                    onChange={(e) => setResolve(e.target.checked)}
                  />
                  Confirm related issue {record.related_issue_id} is resolved
                </label>
              )}
              <button
                type="button"
                onClick={() => {
                  if (next === "COMPLETED" && note.trim().length < 5) {
                    setNoteError("Add a completion note of at least 5 characters.");
                    return;
                  }
                  setNoteError(null);
                  onAdvance(note.trim(), resolve);
                  setNote("");
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Mark as {WORK_STATUS_LABELS[next]}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This work is completed.</p>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="ml-2 inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary"
          >
            <Pencil className="size-4" /> Edit details
          </button>
        </div>
      )}
    </Modal>
  );
}

type FormErrors = Partial<
  Record<"title" | "description" | "location" | "start" | "end" | "team", string>
>;

function WorkForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: WorkRecord | null;
  onCancel: () => void;
  onSave: (record: WorkRecord, isNew: boolean) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<WorkType>(initial?.type ?? WORK_TYPES[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [lat, setLat] = useState<number | null>(initial?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(initial?.longitude ?? null);
  const [start, setStart] = useState(toLocalInput(initial?.start_at ?? ""));
  const [end, setEnd] = useState(toLocalInput(initial?.expected_completion ?? ""));
  const [team, setTeam] = useState(initial?.team ?? "");
  const [issue, setIssue] = useState(initial?.related_issue_id ?? "");
  const [status, setStatus] = useState<WorkStatus>(initial?.status ?? "SCHEDULED");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const issueOptions = useMemo(
    () => [
      ...SAMPLE_ISSUES.map((i) => ({ id: i.id, label: `${i.id} — ${i.title}` })),
      ...listDemoReports().map((r) => ({ id: r.reference, label: `${r.reference} — ${r.title}` })),
    ],
    [],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: FormErrors = {};
    if (title.trim().length < 5 || title.trim().length > 100)
      next.title = "Title must be 5–100 characters.";
    if (description.trim().length < 10 || description.trim().length > 1000)
      next.description = "Description must be 10–1000 characters.";
    if (location.trim().length < 3)
      next.location = "Enter a location name (at least 3 characters).";
    if (!start) next.start = "Choose a start date and time.";
    if (!end) next.end = "Choose an expected completion.";
    else if (start && new Date(end) <= new Date(start))
      next.end = "Expected completion must be after the start.";
    if (team.trim().length < 2) next.team = "Enter the responsible team or department.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    const now = new Date().toISOString();
    const isNew = !initial;
    const history = isNew
      ? [{ at: now, status, note: "Work order created (admin demo)." }]
      : initial.status !== status
        ? [
            ...initial.history,
            { at: now, status, note: `Status set to ${WORK_STATUS_LABELS[status]} while editing.` },
          ]
        : initial.history;
    onSave(
      {
        id: initial?.id ?? nextWorkId(),
        title: title.trim(),
        type,
        location: location.trim(),
        latitude: lat,
        longitude: lng,
        description: description.trim(),
        start_at: new Date(start).toISOString(),
        expected_completion: new Date(end).toISOString(),
        team: team.trim(),
        status,
        photos: initial?.photos ?? [],
        updated_at: now,
        related_issue_id: issue || null,
        completion_note: initial?.completion_note ?? "",
        history,
        issue_resolved: initial?.issue_resolved ?? false,
        source: initial?.source ?? "admin-demo",
      },
      isNew,
    );
  }

  const err = (k: keyof FormErrors) =>
    errors[k] && (
      <span className="mt-1 block text-xs font-medium text-destructive">{errors[k]}</span>
    );

  return (
    <Modal title={initial ? `Edit ${initial.id}` : "New work order"} onClose={onCancel}>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <label className="block text-sm font-medium">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            aria-invalid={Boolean(errors.title)}
            className={inputClass}
          />
          {err("title")}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Work type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WorkType)}
              className={inputClass}
            >
              {WORK_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            {initial ? "Status" : "Initial status"}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as WorkStatus)}
              className={inputClass}
            >
              {WORK_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {WORK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            aria-invalid={Boolean(errors.description)}
            className={inputClass}
          />
          {err("description")}
        </label>
        <label className="block text-sm font-medium">
          Location name
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={150}
            placeholder="Sector 12 · Market Road"
            aria-invalid={Boolean(errors.location)}
            className={inputClass}
          />
          {err("location")}
        </label>
        <div>
          <p className="text-sm font-medium">
            Map point <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <div className="mt-2">
            <LocationPicker
              latitude={lat}
              longitude={lng}
              onChange={(a, b) => {
                setLat(a);
                setLng(b);
              }}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Start
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-invalid={Boolean(errors.start)}
              className={inputClass}
            />
            {err("start")}
          </label>
          <label className="block text-sm font-medium">
            Expected completion
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-invalid={Boolean(errors.end)}
              className={inputClass}
            />
            {err("end")}
          </label>
        </div>
        <label className="block text-sm font-medium">
          Responsible team / department
          <input
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            maxLength={100}
            aria-invalid={Boolean(errors.team)}
            className={inputClass}
          />
          {err("team")}
        </label>
        <label className="block text-sm font-medium">
          Related issue <span className="font-normal text-muted-foreground">(optional)</span>
          <select value={issue} onChange={(e) => setIssue(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {issueOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-sm text-destructive">
            Please fix the highlighted fields.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Wrench className="size-4" />{" "}
            {saving ? "Saving…" : initial ? "Save changes" : "Create work order"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
