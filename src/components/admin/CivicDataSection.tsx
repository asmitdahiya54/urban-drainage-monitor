/**
 * Civic / Environmental Data (Step 10).
 *
 * Reads GET /api/civic-data. When the backend reports `is_mock` the section is
 * wrapped in a loud demo warning so sample values can never be mistaken for
 * official government data.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  CIVIC_DATA_TYPE_LABELS,
  CIVIC_MOCK_LABEL,
  civicApi,
  type CivicDataResponse,
  type CivicDataType,
  type CivicRecord,
} from "@/services/api";

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "All data" },
  ...(Object.keys(CIVIC_DATA_TYPE_LABELS) as CivicDataType[]).map((value) => ({
    value,
    label: CIVIC_DATA_TYPE_LABELS[value],
  })),
];

function formatDateTime(value: string | null): string {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatKey(key: string): string {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function RecordCard({ record }: { record: CivicRecord }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            {CIVIC_DATA_TYPE_LABELS[record.data_type] ?? record.data_type}
          </p>
          <h4 className="mt-1 text-sm font-semibold">{record.title}</h4>
        </div>
        {record.is_mock && (
          <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive">
            Demo data
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {Object.entries(record.values).map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-muted-foreground">{formatKey(key)}</dt>
            <dd className="text-sm font-medium">{String(value ?? "—")}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        {record.location.area_name ? `${record.location.area_name} · ` : ""}
        {record.location.latitude != null && record.location.longitude != null
          ? `${Number(record.location.latitude).toFixed(4)}, ${Number(record.location.longitude).toFixed(4)}`
          : "Location not provided"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Source: {record.source} · Observed {formatDateTime(record.observed_at)}
      </p>
    </li>
  );
}

export function CivicDataSection() {
  const [filter, setFilter] = useState("ALL");
  const [data, setData] = useState<CivicDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (refresh = false) => {
      setLoading(true);
      civicApi
        .data({ data_type: filter, refresh })
        .then((next) => {
          setData(next);
          setError(null);
        })
        .catch((err: unknown) => {
          setError(
            err instanceof ApiError
              ? err.message
              : "The civic data service could not be reached right now.",
          );
        })
        .finally(() => setLoading(false));
    },
    [filter],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, CivicRecord[]>();
    (data?.records ?? []).forEach((record) => {
      const list = map.get(record.data_type) ?? [];
      list.push(record);
      map.set(record.data_type, list);
    });
    return [...map.entries()];
  }, [data]);

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Civic / Environmental Data</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            External infrastructure and environment data shown next to the drainage reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="civic-type">
            Data type
          </label>
          <select
            id="civic-type"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            {TYPE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {data?.is_mock && (
        <p className="mt-4 rounded-lg border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold uppercase tracking-wide text-destructive">
          {CIVIC_MOCK_LABEL}
        </p>
      )}

      {data && (
        <p className="mt-3 text-xs text-muted-foreground">
          {data.disclaimer} Source: {data.source}
          {data.source_url ? ` (${data.source_url})` : ""} · Retrieved{" "}
          {formatDateTime(data.retrieved_at)}
          {data.cached_types.length > 0 ? " · some values served from cache" : ""}
        </p>
      )}

      {loading && !data && (
        <p className="mt-4 text-sm text-muted-foreground">Loading civic data…</p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {data && data.errors.length > 0 && (
        <ul className="mt-4 space-y-2">
          {data.errors.map((item) => (
            <li
              key={`${item.data_type}-${item.reason}`}
              className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground"
            >
              {CIVIC_DATA_TYPE_LABELS[item.data_type as CivicDataType] ?? item.data_type}:{" "}
              {item.message} ({item.reason})
            </li>
          ))}
        </ul>
      )}

      {data && data.records.length === 0 && !error && !loading && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No civic data is available right now.</p>
        </div>
      )}

      <div className="mt-4 space-y-6">
        {grouped.map(([type, records]) => (
          <div key={type}>
            <h3 className="text-sm font-semibold text-muted-foreground">
              {CIVIC_DATA_TYPE_LABELS[type as CivicDataType] ?? type}
            </h3>
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {records.map((record, index) => (
                <RecordCard key={`${type}-${index}`} record={record} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
