/**
 * DEMO maintenance work records — browser-only, not municipal data.
 * Sample records are fictional; admin edits are stored in localStorage.
 */
export type WorkStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";

export const WORK_TYPES = [
  "Drain Cleaning",
  "Drainage Repair",
  "Manhole Repair",
  "Waterlogging Removal",
  "New Drainage Construction",
  "Blockage/Garbage Removal",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};
export const WORK_STATUS_ORDER: WorkStatus[] = ["SCHEDULED", "IN_PROGRESS", "COMPLETED"];
export const WORK_STATUS_COLORS: Record<WorkStatus, string> = {
  SCHEDULED: "#38bdf8",
  IN_PROGRESS: "#a855f7",
  COMPLETED: "#22c55e",
};

export type WorkEvent = { at: string; status: WorkStatus; note: string };

export type WorkRecord = {
  id: string;
  title: string;
  type: WorkType;
  location: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  start_at: string;
  expected_completion: string;
  team: string;
  status: WorkStatus;
  photos: string[];
  updated_at: string;
  related_issue_id: string | null;
  completion_note: string;
  history: WorkEvent[];
  /** Set only when an admin explicitly confirms the linked issue is resolved. */
  issue_resolved?: boolean;
  source: "sample" | "admin-demo";
};

const KEY = "udm.demo_work_records";
const iso = (d: number, h = 9) => new Date(Date.UTC(2026, 8, 30, h) + d * 86400000).toISOString();

function sample(
  id: string,
  title: string,
  type: WorkType,
  location: string,
  lat: number,
  lng: number,
  team: string,
  status: WorkStatus,
  startDay: number,
  endDay: number,
  issue: string | null,
  description: string,
): WorkRecord {
  const history: WorkEvent[] = [
    { at: iso(startDay - 2), status: "SCHEDULED", note: "Work order created (sample)." },
  ];
  if (status !== "SCHEDULED")
    history.push({ at: iso(startDay), status: "IN_PROGRESS", note: "Crew on site (sample)." });
  if (status === "COMPLETED")
    history.push({
      at: iso(endDay, 16),
      status: "COMPLETED",
      note: "Work finished and site cleared (sample).",
    });
  return {
    id,
    title,
    type,
    location,
    latitude: lat,
    longitude: lng,
    description,
    start_at: iso(startDay),
    expected_completion: iso(endDay, 18),
    team,
    status,
    photos: [],
    updated_at: history[history.length - 1]!.at,
    related_issue_id: issue,
    completion_note: status === "COMPLETED" ? "Sample completion note: flow restored." : "",
    history,
    source: "sample",
  };
}

export const SAMPLE_WORK: WorkRecord[] = [
  sample(
    "WO-SAMPLE-001",
    "Desilting market road drain",
    "Drain Cleaning",
    "Sample Sector 12 · Market Road",
    28.6325,
    77.219,
    "Ward 12 Drainage Crew (sample)",
    "IN_PROGRESS",
    -1,
    2,
    "SAMPLE-001",
    "Remove silt from 200 m storm drain and clear inlet grates.",
  ),
  sample(
    "WO-SAMPLE-002",
    "Pump out Ring Road underpass",
    "Waterlogging Removal",
    "Sample Sector 5 · Ring Road underpass",
    28.5925,
    77.2285,
    "Emergency Pump Unit (sample)",
    "IN_PROGRESS",
    0,
    1,
    "SAMPLE-002",
    "Deploy two pumps and clear underpass outlet.",
  ),
  sample(
    "WO-SAMPLE-003",
    "Replace school lane manhole",
    "Manhole Repair",
    "Sample Sector 8 · School Lane",
    28.6508,
    77.191,
    "Sewer Maintenance Dept. (sample)",
    "SCHEDULED",
    2,
    4,
    "SAMPLE-003",
    "Replace damaged frame and lid; jet-clean connected line.",
  ),
  sample(
    "WO-SAMPLE-004",
    "Rebuild collapsed drain wall",
    "Drainage Repair",
    "Sample Sector 12 · Old Town",
    28.6402,
    77.2096,
    "Civil Works Division (sample)",
    "SCHEDULED",
    3,
    9,
    "SAMPLE-008",
    "Reconstruct 15 m of masonry drain wall.",
  ),
  sample(
    "WO-SAMPLE-005",
    "Clear culvert garbage",
    "Blockage/Garbage Removal",
    "Sample Sector 9 · Canal Bridge",
    28.6672,
    77.2306,
    "Sanitation Team B (sample)",
    "COMPLETED",
    -5,
    -4,
    "SAMPLE-005",
    "Remove plastic waste and install debris screen.",
  ),
  sample(
    "WO-SAMPLE-006",
    "New drain along stadium road",
    "New Drainage Construction",
    "Sample Sector 14 · Stadium Road",
    28.6175,
    77.256,
    "Civil Works Division (sample)",
    "SCHEDULED",
    7,
    30,
    "SAMPLE-012",
    "Construct 400 m covered drain to relieve silted channel.",
  ),
  sample(
    "WO-SAMPLE-007",
    "Bus terminal drain flush",
    "Drain Cleaning",
    "Sample Sector 21 · Bus Terminal",
    28.574,
    77.1985,
    "Ward 21 Drainage Crew (sample)",
    "COMPLETED",
    -7,
    -6,
    "SAMPLE-006",
    "Flush drains and clear pooling area.",
  ),
];

function readStored(): WorkRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is WorkRecord =>
        !!r &&
        typeof r === "object" &&
        typeof (r as WorkRecord).id === "string" &&
        WORK_STATUS_ORDER.includes((r as WorkRecord).status) &&
        Array.isArray((r as WorkRecord).history),
    );
  } catch {
    return [];
  }
}

/** Sample records overlaid by any stored edits (same id), plus admin-created records. */
export function loadWork(): WorkRecord[] {
  const stored = readStored();
  const byId = new Map(stored.map((r) => [r.id, r]));
  const merged = SAMPLE_WORK.map((s) => byId.get(s.id) ?? s);
  const extra = stored.filter((r) => !SAMPLE_WORK.some((s) => s.id === r.id));
  return [...extra, ...merged];
}

export function saveWork(record: WorkRecord) {
  const stored = readStored().filter((r) => r.id !== record.id);
  window.localStorage.setItem(KEY, JSON.stringify([...stored, record]));
}

export function nextWorkId(): string {
  const n = loadWork().filter((r) => r.source === "admin-demo").length + 1;
  let id = `WO-DEMO-${String(n).padStart(4, "0")}`;
  let i = n;
  while (loadWork().some((r) => r.id === id)) id = `WO-DEMO-${String(++i).padStart(4, "0")}`;
  return id;
}

export function nextStatus(s: WorkStatus): WorkStatus | null {
  const i = WORK_STATUS_ORDER.indexOf(s);
  return WORK_STATUS_ORDER[i + 1] ?? null;
}
