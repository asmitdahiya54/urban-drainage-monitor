import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { LazyMap } from "@/components/map/LazyMap";
import type { MapMarker } from "@/components/map/MapCanvas";
import {
  ApiError,
  adminApi,
  ISSUE_TYPE_LABELS,
  STATUS_LABELS,
  type DrainageReport,
} from "@/services/api";

export const Route = createFileRoute("/admin_/map")({
  head: () => ({
    meta: [
      { title: "Reports Map | Urban Drainage Monitor Admin" },
      {
        name: "description",
        content:
          "Map of every reported drainage problem in the city, with issue type, severity and status for each marker.",
      },
      { property: "og:title", content: "Reports Map | Urban Drainage Monitor Admin" },
      {
        property: "og:description",
        content: "Administrator map of all citizen drainage reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute role="admin">
      <AdminMapPage />
    </ProtectedRoute>
  ),
});

function AdminMapPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DrainageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .reports({ per_page: 100 })
      .then((page) => {
        setReports(page.reports);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "The map data could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, []);

  const markers: MapMarker[] = useMemo(
    () =>
      reports.map((report) => ({
        id: report.id,
        latitude: report.latitude,
        longitude: report.longitude,
        title: `#${report.id} · ${ISSUE_TYPE_LABELS[report.issue_type] ?? report.issue_type}`,
        lines: [
          `Severity: ${report.severity}`,
          `Status: ${STATUS_LABELS[report.status]}`,
          `Date: ${report.created_at ? new Date(report.created_at).toLocaleDateString() : "—"}`,
        ],
      })),
    [reports],
  );

  const center = markers[0]
    ? ([markers[0].latitude, markers[0].longitude] as [number, number])
    : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Administration</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Reports map</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Every reported drainage problem. Click a marker to see the details and open the report.
        </p>

        {loading && <p className="mt-8 text-sm text-muted-foreground">Loading reports…</p>}
        {error && !loading && (
          <p
            role="alert"
            className="mt-8 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="mt-8 h-[520px] overflow-hidden rounded-xl border border-border">
            <LazyMap
              latitude={null}
              longitude={null}
              zoom={12}
              {...(center ? { fallbackCenter: center } : {})}
              markers={markers}
              onSelectMarker={(id) =>
                navigate({ to: "/admin/reports/$id", params: { id: String(id) } })
              }
              label="Loading city map…"
            />
          </div>
        )}

        {!loading && !error && markers.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No reports to show on the map yet.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
