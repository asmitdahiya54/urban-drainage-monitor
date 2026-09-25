import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AdminFilters,
  EMPTY_FILTERS,
  type AdminFilterState,
} from "@/components/admin/AdminFilters";
import { AdminReportsTable } from "@/components/admin/AdminReportsTable";
import { AnalyticsSection } from "@/components/admin/AnalyticsSection";
import { CivicDataSection } from "@/components/admin/CivicDataSection";
import { RiskPredictionSection } from "@/components/admin/RiskPredictionSection";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/context/AuthContext";
import {
  ApiError,
  adminApi,
  STATUS_LABELS,
  type AdminReportsPage,
  type AdminStats,
  type ReportStatus,
} from "@/services/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Municipal dashboard for Urban Drainage Monitor: live report counts, filters and status management for every drainage report.",
      },
      { property: "og:title", content: "Admin Dashboard | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Manage citizen drainage reports and their status from one dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute role="admin">
      <AdminPage />
    </ProtectedRoute>
  ),
});

const STATUS_CARD_ORDER: ReportStatus[] = [
  "NEW",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];

const PER_PAGE = 10;

function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [filters, setFilters] = useState<AdminFilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminReportsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    adminApi
      .stats()
      .then((next) => {
        setStats(next);
        setStatsError(null);
      })
      .catch((err: Error) => setStatsError(err.message));
  }, []);

  useEffect(loadStats, [loadStats]);

  // Filters and pagination are sent to the backend, which does the work in SQL.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi
      .reports({ ...filters, page, per_page: PER_PAGE })
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "The reports could not be loaded right now.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  const cards = useMemo(
    () => [
      { label: "Total reports", value: stats?.reports },
      ...STATUS_CARD_ORDER.map((status) => ({
        label: STATUS_LABELS[status],
        value: stats?.by_status?.[status],
      })),
    ],
    [stats],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Admin dashboard</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Signed in as {user?.email}. Counts come straight from the database.
            </p>
          </div>
          <Link
            to="/admin/map"
            className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Reports map
          </Link>
        </div>

        {statsError ? (
          <p
            role="alert"
            className="mt-8 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {statsError}
          </p>
        ) : (
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-border bg-card p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </dt>
                <dd className="mt-1 text-2xl font-bold">{card.value ?? "…"}</dd>
              </div>
            ))}
          </dl>
        )}

        <AnalyticsSection />

        <RiskPredictionSection />

        <CivicDataSection />

        <h2 className="mt-12 text-lg font-semibold">All drainage reports</h2>
        <div className="mt-4">
          <AdminFilters
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
          />
        </div>

        <div className="mt-6">
          {loading && <p className="text-sm text-muted-foreground">Loading reports…</p>}

          {error && !loading && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {!loading && !error && data && data.reports.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No reports match these filters yet.</p>
            </div>
          )}

          {!loading && !error && data && data.reports.length > 0 && (
            <>
              <AdminReportsTable reports={data.reports} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Page {data.page} of {data.pages} · {data.total} report
                  {data.total === 1 ? "" : "s"}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!data.has_prev}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!data.has_next}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
