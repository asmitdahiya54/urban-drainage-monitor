import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { LazyGoogleMap } from "@/components/map/LazyGoogleMap";
import { LazyMap } from "@/components/map/LazyMap";
import { hasGoogleMapsKey } from "@/components/map/googleMapsLoader";
import type { HeatPoint, MapHotspot, MapMarker } from "@/components/map/MapCanvas";
import {
  ApiError,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  SEVERITIES,
  STATUS_LABELS,
  publicMapApi,
  type Hotspot,
  type MapReport,
  type MapSummary,
  type ReportStatus,
} from "@/services/api";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Drainage Map | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "A public interactive map of reported drainage problems, heat density and PostGIS hotspot analysis across the city.",
      },
      { property: "og:title", content: "Drainage Map | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Explore reported drainage problems, heat density and hotspots across the city.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

const PUBLIC_STATUSES: ReportStatus[] = [
  "NEW",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
];

const toneFor = (severity: string) => severity.toLowerCase();

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="ALL">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MapPage() {
  const navigate = useNavigate();
  const [issueType, setIssueType] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [showHeat, setShowHeat] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [clusterRadius, setClusterRadius] = useState("2000");
  const [basemap, setBasemap] = useState<"google" | "leaflet">(
    hasGoogleMapsKey ? "google" : "leaflet",
  );

  const [reports, setReports] = useState<MapReport[]>([]);
  const [summary, setSummary] = useState<MapSummary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const filters = { issue_type: issueType, severity, status };

    setLoading(true);
    Promise.all([
      publicMapApi.reports(filters),
      publicMapApi.hotspots({ ...filters, radius_m: Number(clusterRadius) }),
    ])
      .then(([mapData, hotspotData]) => {
        if (cancelled) return;
        setReports(mapData.reports);
        setSummary(mapData.summary);
        setHotspots(hotspotData.hotspots);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReports([]);
        setHotspots([]);
        setError(
          err instanceof ApiError ? err.message : "The map data could not be loaded right now.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [issueType, severity, status, clusterRadius]);

  const markers: MapMarker[] = useMemo(
    () =>
      reports.map((report) => ({
        id: report.id,
        latitude: report.latitude,
        longitude: report.longitude,
        title: `#${report.id} · ${ISSUE_TYPE_LABELS[report.issue_type] ?? report.issue_type}`,
        lines: [
          `Severity: ${report.severity}`,
          `Status: ${STATUS_LABELS[report.status] ?? report.status}`,
          `Reported: ${report.created_at ? new Date(report.created_at).toLocaleDateString() : "—"}`,
        ],
        tone: toneFor(report.severity),
      })),
    [reports],
  );

  const heatPoints: HeatPoint[] = useMemo(
    () => reports.map((r) => [r.latitude, r.longitude, r.weight] as HeatPoint),
    [reports],
  );

  const hotspotCircles: MapHotspot[] = useMemo(
    () =>
      hotspots.map((hotspot) => ({
        id: hotspot.cluster_id,
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
        radiusM: hotspot.radius_m,
        reportCount: hotspot.report_count,
        label: `Severity score ${hotspot.severity_score} · ${hotspot.resolved_count} resolved`,
      })),
    [hotspots],
  );

  const center = markers[0]
    ? ([markers[0].latitude, markers[0].longitude] as [number, number])
    : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Open city data</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Drainage Map</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Every drainage problem reported by the community, shown as markers, a density heatmap and
          spatial hotspot clusters. No personal details of the people who reported are shown.
        </p>

        {summary && !loading && !error && (
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Reports shown", value: summary.total },
              { label: "Resolved", value: summary.resolved },
              { label: "High / critical", value: summary.high_severity },
              { label: "Hotspots", value: hotspots.length },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-border bg-card p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </dt>
                <dd className="mt-1 text-2xl font-bold">{card.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
          <Select
            label="Issue type"
            value={issueType}
            onChange={setIssueType}
            options={ISSUE_TYPES.map((i) => ({ value: i.value, label: i.label }))}
          />
          <Select
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={SEVERITIES.map((s) => ({ value: s.value, label: s.label }))}
          />
          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            options={PUBLIC_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
          <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showHeat}
                onChange={(event) => setShowHeat(event.target.checked)}
              />
              Heatmap layer
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={(event) => setShowHotspots(event.target.checked)}
              />
              Hotspot clusters
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Hotspot distance</span>
              <select
                value={clusterRadius}
                onChange={(event) => setClusterRadius(event.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="500">500 m</option>
                <option value="1000">1 km</option>
                <option value="2000">2 km</option>
                <option value="5000">5 km</option>
              </select>
            </label>
          </div>
        </div>

        {loading && <p className="mt-8 text-sm text-muted-foreground">Loading map data…</p>}

        {error && !loading && (
          <p
            role="alert"
            className="mt-8 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div
                role="group"
                aria-label="Basemap provider"
                className="inline-flex rounded-lg border border-border bg-card p-1"
              >
                {(
                  [
                    { value: "google", label: "Google Maps" },
                    { value: "leaflet", label: "Leaflet GIS" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBasemap(option.value)}
                    aria-pressed={basemap === option.value}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                      basemap === option.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <ul className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {[
                  { color: "#dc2626", label: "High risk" },
                  { color: "#f59e0b", label: "Medium risk" },
                  { color: "#22c55e", label: "Low risk" },
                ].map((item) => (
                  <li key={item.label} className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>

            {basemap === "google" && !hasGoogleMapsKey && (
              <p className="mt-3 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
                Google Maps is not configured yet — add VITE_GOOGLE_MAPS_API_KEY to the frontend
                environment. The Leaflet GIS basemap stays available meanwhile.
              </p>
            )}

            <div className="mt-3 h-[520px] overflow-hidden rounded-xl border border-border">
              {basemap === "google" ? (
                <LazyGoogleMap
                  center={center ?? [28.6139, 77.209]}
                  zoom={12}
                  markers={markers}
                  heatPoints={heatPoints}
                  showHeat={showHeat}
                  {...(showHotspots ? { hotspots: hotspotCircles } : {})}
                  onSelectMarker={(id) =>
                    navigate({ to: "/report/$id", params: { id: String(id) } })
                  }
                />
              ) : (
                <LazyMap
                  latitude={null}
                  longitude={null}
                  zoom={12}
                  {...(center ? { fallbackCenter: center } : {})}
                  markers={markers}
                  heatPoints={heatPoints}
                  showHeat={showHeat}
                  {...(showHotspots ? { hotspots: hotspotCircles } : {})}
                  label="Loading city map…"
                />
              )}
            </div>

            {markers.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                No reports match these filters yet. Try clearing the filters or be the first to
                report a drainage problem.
              </p>
            )}

            <section className="mt-10">
              <h2 className="text-xl font-semibold">Spatial hotspots</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Clusters of nearby reports, grouped inside the database and ranked by severity.
              </p>
              {hotspots.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No hotspot clusters detected for the current filters.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {hotspots.map((hotspot) => (
                    <li
                      key={hotspot.cluster_id}
                      className="rounded-xl border border-border bg-card p-4 text-sm"
                    >
                      <p className="font-semibold">
                        {hotspot.report_count} reports · severity score {hotspot.severity_score}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Centre {hotspot.latitude.toFixed(4)}, {hotspot.longitude.toFixed(4)} ·
                        approx. radius {Math.round(hotspot.radius_m)} m
                      </p>
                      <p className="text-muted-foreground">{hotspot.resolved_count} resolved</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
