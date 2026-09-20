/**
 * Reusable API client for the Flask backend.
 *
 * - Base URL comes from VITE_API_URL (never a hard-coded production URL).
 * - Attaches the JWT as `Authorization: Bearer <token>` when present.
 * - Normalises every failure into an ApiError with a readable message.
 */

// Defaults to the same-origin path so a build without VITE_API_URL still goes
// through the server-side proxy (src/routes/api.$.ts) instead of the viewer's
// own machine.
export const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "/api";

export const TOKEN_STORAGE_KEY = "udm.access_token";

export class ApiError extends Error {
  status: number;
  field?: string | undefined;

  constructor(message: string, status: number, field?: string | undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — session stays in memory only */
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null | undefined;
  auth?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false } = options;
  const token = options.token ?? (auth ? getStoredToken() : null);

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError("Cannot reach the server. Make sure the backend is running.", 0);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const payload = (data ?? {}) as { error?: string; field?: string };
    throw new ApiError(
      payload.error ?? `Request failed (${response.status})`,
      response.status,
      payload.field,
    );
  }

  return data as T;
}

// --- Domain types ---------------------------------------------------------
export type UserRole = "citizen" | "admin";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string | null;
  updated_at?: string | null;
};

export type AuthResponse = { access_token: string; user: AuthUser };

export const authApi = {
  register: (input: { name: string; email: string; password: string }) =>
    apiRequest<AuthResponse>("/auth/register", { method: "POST", body: input }),

  login: (input: { email: string; password: string }) =>
    apiRequest<AuthResponse>("/auth/login", { method: "POST", body: input }),

  me: (token?: string | null | undefined) =>
    apiRequest<{ user: AuthUser }>("/auth/me", { auth: true, token }),

  logout: () => apiRequest<{ message: string }>("/auth/logout", { method: "POST", auth: true }),
};

export type AdminStats = {
  users: number;
  citizens: number;
  admins: number;
  reports: number;
  by_status: Record<string, number>;
};

export type AdminReportFilters = {
  status?: string;
  severity?: string;
  issue_type?: string;
  search?: string;
  page?: number;
  per_page?: number;
};

export type AdminReportsPage = {
  reports: DrainageReport[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
};

// --- Admin analytics (Step 7) --------------------------------------------
// Every figure below is aggregated by PostgreSQL/PostGIS, not in the browser.
export type CountRow = { key: string; count: number; resolved?: number };

export type AnalyticsTotals = {
  total: number;
  resolved: number;
  rejected: number;
  unresolved: number;
  high_severity: number;
  recent: number;
  awaiting_review: number;
  recent_days: number;
  resolution_rate: number;
};

export type AnalyticsDay = {
  day: string;
  count: number;
  high_severity: number;
  resolved: number;
};

export type AnalyticsMonth = { month: string; count: number; resolved: number };

export type AdminAnalytics = {
  totals: AnalyticsTotals;
  by_status: CountRow[];
  by_severity: CountRow[];
  by_issue_type: CountRow[];
  over_time: AnalyticsDay[];
  by_month: AnalyticsMonth[];
  resolution_speed: {
    resolved_count: number;
    avg_hours: number | null;
    median_hours: number | null;
  };
  spatial: {
    located: number;
    center_latitude: number | null;
    center_longitude: number | null;
    spread_m: number | null;
  };
  params: { days: number; months: number; recent_days: number };
};

export const adminApi = {
  stats: () => apiRequest<AdminStats>("/admin/stats", { auth: true }),

  analytics: (params: { days?: number; months?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.days) query.set("days", String(params.days));
    if (params.months) query.set("months", String(params.months));
    const qs = query.toString();
    return apiRequest<AdminAnalytics>(`/admin/analytics${qs ? `?${qs}` : ""}`, { auth: true });
  },

  /** Filtering and pagination happen in SQL — never in the browser. */
  reports: (filters: AdminReportFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "" && value !== "ALL") {
        params.set(key, String(value));
      }
    });
    const query = params.toString();
    return apiRequest<AdminReportsPage>(`/admin/reports${query ? `?${query}` : ""}`, {
      auth: true,
    });
  },

  report: (id: number) =>
    apiRequest<{ report: DrainageReport }>(`/admin/reports/${id}`, { auth: true }),

  updateStatus: (id: number, input: { status: ReportStatus; comment?: string }) =>
    apiRequest<{ message: string; changed: boolean; report: DrainageReport }>(
      `/admin/reports/${id}/status`,
      { method: "PUT", body: input, auth: true },
    ),
};

// --- Drainage reports -----------------------------------------------------
export const ISSUE_TYPES = [
  { value: "BLOCKED_DRAIN", label: "Blocked drain" },
  { value: "WATERLOGGING", label: "Waterlogging" },
  { value: "DRAIN_OVERFLOW", label: "Drain overflow" },
  { value: "SEWAGE_OVERFLOW", label: "Sewage overflow" },
  { value: "DAMAGED_DRAIN", label: "Damaged drain" },
  { value: "FLOODING", label: "Flooding" },
  { value: "OTHER", label: "Other" },
] as const;

export const SEVERITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number]["value"];
export type Severity = (typeof SEVERITIES)[number]["value"];
export type ReportStatus =
  | "NEW"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED";

export const STATUS_LABELS: Record<ReportStatus, string> = {
  NEW: "New",
  PENDING_VERIFICATION: "Pending verification",
  VERIFIED: "Verified",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

export const ISSUE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ISSUE_TYPES.map((i) => [i.value, i.label]),
);

export type StatusHistoryEntry = {
  id: number;
  report_id: number;
  old_status: ReportStatus | null;
  new_status: ReportStatus;
  changed_by: number | null;
  changed_at: string | null;
  comment: string | null;
  changed_by_name?: string | null;
  changed_by_role?: string | null;
};

export type DrainageReport = {
  id: number;
  user_id: number;
  issue_type: IssueType;
  description: string | null;
  severity: Severity;
  status: ReportStatus;
  latitude: number;
  longitude: number;
  image_path: string | null;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
  reporter: { id: number; name: string; email: string } | null;
  status_history?: StatusHistoryEntry[];
  allowed_next_statuses?: ReportStatus[];
};

export type NewReportInput = {
  issue_type: IssueType | "";
  description: string;
  severity: Severity | "";
  latitude: number;
  longitude: number;
};

// --- Duplicate detection (Step 8) ----------------------------------------
// Privacy-safe: ids, classification, status, distance and dates only.
export type DuplicateMatch = {
  id: number;
  issue_type: IssueType;
  severity: Severity;
  status: ReportStatus;
  created_at: string | null;
  resolved_at: string | null;
  distance_m: number;
  age_days: number;
  same_issue_type: boolean;
  confidence: number;
  likely_duplicate: boolean;
};

export type DuplicateCheck = {
  duplicate: boolean;
  matches: DuplicateMatch[];
  nearby: DuplicateMatch[];
  count: number;
  nearby_count: number;
  message: string;
  params: { radius_m: number; days: number; threshold: number };
};

export const reportsApi = {
  create: (input: NewReportInput & { confirm_duplicate?: boolean }) =>
    apiRequest<{ message: string; report: DrainageReport }>("/reports", {
      method: "POST",
      body: input,
      auth: true,
    }),

  /** Ask the backend (PostGIS) whether a similar report already exists nearby. */
  checkDuplicate: (input: {
    latitude: number;
    longitude: number;
    issue_type: IssueType;
    severity?: Severity | "";
  }) =>
    apiRequest<DuplicateCheck>("/reports/check-duplicate", {
      method: "POST",
      body: input,
      auth: true,
    }),

  list: () => apiRequest<{ reports: DrainageReport[]; count: number }>("/reports", { auth: true }),

  get: (id: number | string) =>
    apiRequest<{ report: DrainageReport }>(`/reports/${id}`, { auth: true }),
};

// --- Public map (Step 6) --------------------------------------------------
// These endpoints need no token and contain no personal data.
export type MapReport = {
  id: number;
  issue_type: IssueType;
  severity: Severity;
  status: ReportStatus;
  latitude: number;
  longitude: number;
  weight: number;
  created_at: string | null;
  resolved_at: string | null;
};

export type MapSummary = { total: number; resolved: number; high_severity: number };

export type Hotspot = {
  cluster_id: number;
  report_count: number;
  resolved_count: number;
  latitude: number;
  longitude: number;
  radius_m: number;
  severity_score: number;
};

export type MapFilters = {
  issue_type?: string;
  severity?: string;
  status?: string;
  days?: number;
  radius_m?: number;
  min_points?: number;
};

function mapQuery(filters: MapFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "ALL") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const publicMapApi = {
  reports: (filters: MapFilters = {}) =>
    apiRequest<{ reports: MapReport[]; count: number; summary: MapSummary }>(
      `/reports/map${mapQuery(filters)}`,
    ),

  hotspots: (filters: MapFilters = {}) =>
    apiRequest<{ hotspots: Hotspot[]; count: number }>(`/reports/hotspots${mapQuery(filters)}`),

  /** Prototype risk overlay — coordinates and scores only, no citizen data. */
  riskAreas: () => apiRequest<PublicRiskAreas>("/reports/risk-areas"),
};

// --- ML risk prediction prototype (Step 9) -------------------------------
// A baseline model trained on aggregated report data against a documented
// proxy target. Never an official flood warning.
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskIndicators = {
  report_count: number;
  recent_count: number;
  high_severity_count: number;
  unresolved_count: number;
  resolved_count: number;
  flood_related_count: number;
  issue_type_variety: number;
  density_per_km2: number;
  days_since_last_report: number;
};

export type RiskPrediction = {
  id: number;
  latitude: number;
  longitude: number;
  risk_score: number;
  risk_level: RiskLevel;
  prediction_date: string | null;
  model_version: string;
  indicators: RiskIndicators | null;
};

export type RiskPredictionsResponse = {
  predictions: RiskPrediction[];
  count: number;
  trained: boolean;
  model_type: string;
  model_version: string;
  features: string[];
  generated_at: string | null;
  message?: string;
  thresholds?: { medium: number; high: number };
  disclaimer: string;
  limitations: string[];
};

export type RiskTrainingResult = {
  trained: boolean;
  insufficient_data?: boolean;
  reason?: string | null;
  model_type: string;
  model_version: string;
  features: string[];
  samples: number;
  areas: number;
  stored_predictions: number;
  target: { kind: string; labelling: string | null };
  validation: {
    performed: boolean;
    method?: string | null;
    accuracy: number | null;
    roc_auc: number | null;
    note: string | null;
  };
  feature_importance?: { feature: string; coefficient: number }[];
  warnings: string[];
  limitations: string[];
  disclaimer: string;
  params: { cell_degrees: number; recent_days: number };
};

export type PublicRiskArea = {
  latitude: number;
  longitude: number;
  risk_level: RiskLevel;
  risk_score: number;
  prediction_date: string | null;
  report_count: number | null;
};

export type PublicRiskAreas = {
  areas: PublicRiskArea[];
  count: number;
  model_version: string;
  disclaimer: string;
};

export const RISK_DISCLAIMER =
  "Prototype risk prediction based on available crowdsourced report data. Predictions are not official flood warnings.";

export const riskApi = {
  train: () =>
    apiRequest<RiskTrainingResult>("/admin/risk-model/train", { method: "POST", auth: true }),

  predictions: () => apiRequest<RiskPredictionsResponse>("/admin/risk-predictions", { auth: true }),
};

// --- Civic / environmental data integration (Step 10) --------------------
// The backend integration layer returns either clearly labelled demo data or,
// once an operator configures a real source, data from that source. `is_mock`
// decides whether the UI shows the demo warning.
export type CivicDataType =
  "RAINFALL" | "DRAINAGE_INFRASTRUCTURE" | "FLOOD_INCIDENT" | "MUNICIPAL_SERVICE";

export const CIVIC_DATA_TYPE_LABELS: Record<CivicDataType, string> = {
  RAINFALL: "Rainfall / weather",
  DRAINAGE_INFRASTRUCTURE: "Drainage infrastructure",
  FLOOD_INCIDENT: "Flood incidents",
  MUNICIPAL_SERVICE: "Municipal services",
};

export type CivicRecord = {
  data_type: CivicDataType;
  title: string;
  location: { latitude: number | null; longitude: number | null; area_name?: string | null };
  observed_at: string | null;
  values: Record<string, string | number | boolean | null>;
  source: string;
  source_url: string | null;
  is_mock: boolean;
  notes: string | null;
};

export type CivicDataError = { data_type: string; reason: string; message: string };

export type CivicDataResponse = {
  records: CivicRecord[];
  count: number;
  source: string;
  source_url: string | null;
  is_mock: boolean;
  label: string;
  provider: {
    provider: string;
    source: string;
    source_url: string | null;
    is_mock: boolean;
    supported_types: string[];
  };
  requested_types: string[];
  available_types: string[];
  cached_types: string[];
  location: { latitude: number; longitude: number };
  retrieved_at: string;
  errors: CivicDataError[];
  disclaimer: string;
};

export const CIVIC_MOCK_LABEL = "DEMO DATA — NOT OFFICIAL GOVERNMENT DATA";

export const civicApi = {
  data: (params: { data_type?: string; refresh?: boolean } = {}) => {
    const query = new URLSearchParams();
    if (params.data_type && params.data_type !== "ALL") query.set("data_type", params.data_type);
    if (params.refresh) query.set("refresh", "1");
    const qs = query.toString();
    return apiRequest<CivicDataResponse>(`/civic-data${qs ? `?${qs}` : ""}`, { auth: true });
  },
};
