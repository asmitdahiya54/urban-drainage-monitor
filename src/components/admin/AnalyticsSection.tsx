/**
 * Admin analytics (Step 7).
 *
 * All numbers arrive pre-aggregated from GET /api/admin/analytics — this
 * component only draws them. Charts are lightweight CSS bars and one inline
 * SVG area chart, so the design stays consistent with the rest of the app and
 * no charting dependency is needed.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  adminApi,
  ISSUE_TYPE_LABELS,
  STATUS_LABELS,
  type AdminAnalytics,
  type CountRow,
} from "@/services/api";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const SEVERITY_BAR: Record<string, string> = {
  LOW: "bg-sky-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-destructive",
};

function BarList({
  rows,
  labels,
  colors,
  emptyText,
}: {
  rows: CountRow[];
  labels: Record<string, string>;
  colors?: Record<string, string>;
  emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const anyData = rows.some((row) => row.count > 0);

  if (!anyData) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{labels[row.key] ?? row.key}</span>
            <span className="font-semibold tabular-nums">{row.count}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${colors?.[row.key] ?? "bg-primary"}`}
              style={{ width: `${(row.count / max) * 100}%` }}
              role="presentation"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TrendChart({ series }: { series: AdminAnalytics["over_time"] }) {
  const { path, area, max, ticks } = useMemo(() => {
    const width = 600;
    const height = 140;
    const peak = Math.max(1, ...series.map((point) => point.count));
    const step = series.length > 1 ? width / (series.length - 1) : width;
    const points = series.map((point, index) => {
      const x = index * step;
      const y = height - (point.count / peak) * (height - 12) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = points.length ? `M ${points.join(" L ")}` : "";
    const filled = points.length ? `${line} L ${width},${height} L 0,${height} Z` : "";
    const labels = series.length
      ? [series[0], series[Math.floor(series.length / 2)], series[series.length - 1]]
          .filter(Boolean)
          .map((point) => point!.day)
      : [];
    return { path: line, area: filled, max: peak, ticks: labels };
  }, [series]);

  const total = series.reduce((sum, point) => sum + point.count, 0);

  if (!series.length || total === 0) {
    return (
      <p className="text-sm text-muted-foreground">No reports were submitted in this period yet.</p>
    );
  }

  return (
    <div>
      <svg
        viewBox="0 0 600 140"
        preserveAspectRatio="none"
        className="h-36 w-full"
        role="img"
        aria-label={`Reports per day, peak ${max} reports`}
      >
        <path d={area} className="fill-primary/15" />
        <path
          d={path}
          className="stroke-primary"
          fill="none"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {total} report{total === 1 ? "" : "s"} in this period · busiest day {max}
      </p>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function hours(value: number | null): string {
  if (value === null) return "—";
  if (value < 24) return `${value} h`;
  return `${(value / 24).toFixed(1)} days`;
}

export function AnalyticsSection() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    adminApi
      .analytics({ days, months: 6 })
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "The analytics could not be loaded right now.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(load, [load]);

  const totals = data?.totals;

  return (
    <section aria-labelledby="analytics-heading" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="analytics-heading" className="text-lg font-semibold">
            Analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Trends and problem areas, aggregated in the database.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Period</span>
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && !data && <p className="mt-6 text-sm text-muted-foreground">Loading analytics…</p>}

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {!error && data && totals && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {totals.total === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No reports have been submitted yet, so there is nothing to analyse.
              </p>
            </div>
          ) : (
            <>
              <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card label="Total reports" value={String(totals.total)} />
                <Card
                  label="Open / unresolved"
                  value={String(totals.unresolved)}
                  hint={`${totals.awaiting_review} awaiting first review`}
                />
                <Card
                  label="Resolved"
                  value={String(totals.resolved)}
                  hint={`${totals.resolution_rate}% resolution rate`}
                />
                <Card
                  label="High / critical"
                  value={String(totals.high_severity)}
                  hint={`${totals.recent} in the last ${totals.recent_days} days`}
                />
              </dl>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold">Reports over time</h3>
                  <div className="mt-3">
                    <TrendChart series={data.over_time} />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold">Reports by status</h3>
                  <div className="mt-3">
                    <BarList
                      rows={data.by_status}
                      labels={STATUS_LABELS}
                      emptyText="No reports to break down yet."
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold">Reports by severity</h3>
                  <div className="mt-3">
                    <BarList
                      rows={data.by_severity}
                      labels={SEVERITY_LABELS}
                      colors={SEVERITY_BAR}
                      emptyText="No reports to break down yet."
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold">Reports by issue type</h3>
                  <div className="mt-3">
                    <BarList
                      rows={data.by_issue_type}
                      labels={ISSUE_TYPE_LABELS}
                      emptyText="No reports to break down yet."
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Card
                  label="Average time to resolve"
                  value={hours(data.resolution_speed.avg_hours)}
                  hint={`${data.resolution_speed.resolved_count} resolved report${
                    data.resolution_speed.resolved_count === 1 ? "" : "s"
                  }`}
                />
                <Card
                  label="Median time to resolve"
                  value={hours(data.resolution_speed.median_hours)}
                />
                <Card
                  label="Reported area spread"
                  value={
                    data.spatial.spread_m === null
                      ? "—"
                      : `${(data.spatial.spread_m / 1000).toFixed(1)} km`
                  }
                  hint={
                    data.spatial.center_latitude === null
                      ? undefined
                      : `Centre ${data.spatial.center_latitude.toFixed(4)}, ${data.spatial.center_longitude?.toFixed(4)}`
                  }
                />
              </div>

              {data.by_month.length > 0 && (
                <div className="mt-4 rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold">Monthly totals</h3>
                  <div className="mt-3">
                    <BarList
                      rows={data.by_month.map((row) => ({ key: row.month, count: row.count }))}
                      labels={Object.fromEntries(
                        data.by_month.map((row) => [row.month, row.month]),
                      )}
                      emptyText="No monthly data yet."
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
