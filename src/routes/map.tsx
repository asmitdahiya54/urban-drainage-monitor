import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BackendWarning } from "@/components/BackendStatus";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { LazyGoogleMap } from "@/components/map/LazyGoogleMap";
import { LazyMap } from "@/components/map/LazyMap";
import { hasGoogleMapsKey } from "@/components/map/googleMapsLoader";
import type { HeatPoint, MapHotspot, MapMarker } from "@/components/map/MapCanvas";
import { listDemoReports } from "@/lib/demoReports";
import { adminStatusOverrides, toMapStatus } from "@/lib/demoIssueAdmin";
import {
  WORK_STATUS_COLORS,
  WORK_STATUS_LABELS,
  WORK_STATUS_ORDER,
  loadWork,
  type WorkRecord,
} from "@/lib/maintenance";
import {
  MAP_CATEGORIES,
  MAP_STATUS_LABELS,
  SAMPLE_ISSUES,
  type MapIssue,
  type MapIssueSeverity,
  type MapIssueStatus,
} from "@/data/sampleIssues";
import { ISSUE_TYPE_LABELS, publicMapApi, type Hotspot, type MapReport } from "@/services/api";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Drainage Issues Map | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Interactive map of drainage issues with severity colours, filters, search, issue details, heatmap and hotspot layers.",
      },
      { property: "og:title", content: "Drainage Issues Map | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Explore drainage issues by category, severity and status on an interactive map.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

const SEVERITY_ORDER: MapIssueSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const SEVERITY_COLORS: Record<MapIssueSeverity, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};
const SOURCE_LABELS: Record<MapIssue["source"], string> = {
  sample: "SAMPLE DATA",
  "local-demo": "YOUR DEMO REPORT",
  live: "LIVE REPORT",
};
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function liveStatus(status: string): MapIssueStatus {
  if (status === "RESOLVED") return "RESOLVED";
  if (status === "IN_PROGRESS" || status === "ASSIGNED") return "IN_PROGRESS";
  return "OPEN";
}

function fromLive(r: MapReport): MapIssue {
  const label = ISSUE_TYPE_LABELS[r.issue_type] ?? r.issue_type;
  return {
    id: `#${r.id}`,
    title: label,
    category: label,
    severity: r.severity,
    status: liveStatus(r.status),
    location: `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`,
    description: "Community report from the live server.",
    reported_at: r.created_at ?? "",
    latitude: r.latitude,
    longitude: r.longitude,
    source: "live",
  };
}

function fromLocalDemo(): MapIssue[] {
  return listDemoReports().map((r) => {
    const status: MapIssueStatus = "OPEN";
    return {
      id: r.reference,
      title: r.title,
      category: r.category,
      severity: (SEVERITY_ORDER.includes(r.severity as MapIssueSeverity)
        ? r.severity
        : "MEDIUM") as MapIssueSeverity,
      status,
      location: r.landmark || `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`,
      description: r.description,
      reported_at: r.created_at,
      latitude: r.latitude,
      longitude: r.longitude,
      source: "local-demo",
    };
  });
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="ALL">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SourceBadge({ source }: { source: MapIssue["source"] }) {
  const tone =
    source === "live"
      ? "border-primary/50 text-primary"
      : source === "local-demo"
        ? "border-sky-500/50 text-sky-500"
        : "border-amber-500/50 text-amber-500";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${tone}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}

function MapPage() {
  const [category, setCategory] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [showHeat, setShowHeat] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);
  const [basemap, setBasemap] = useState<"google" | "leaflet">(
    hasGoogleMapsKey ? "google" : "leaflet",
  );
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [showWork, setShowWork] = useState(true);
  const [work, setWork] = useState<WorkRecord[]>([]);

  const [live, setLive] = useState<MapIssue[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [localDemo, setLocalDemo] = useState<MapIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    setLocalDemo(fromLocalDemo());
    setWork(loadWork());
    let cancelled = false;
    Promise.allSettled([publicMapApi.reports({}), publicMapApi.hotspots({ radius_m: 2000 })]).then(
      ([reportsRes, hotspotRes]) => {
        if (cancelled) return;
        if (reportsRes.status === "fulfilled") {
          setLive(reportsRes.value.reports.map(fromLive));
          setBackendOnline(reportsRes.value.reports.length > 0);
        }
        if (hotspotRes.status === "fulfilled") setHotspots(hotspotRes.value.hotspots);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Combined list; ids are unique per source (#n, UDM-DEMO-n, SAMPLE-n).
  const allIssues = useMemo(() => {
    const seen = new Set<string>();
    const overrides = adminStatusOverrides();
    return [...live, ...localDemo, ...SAMPLE_ISSUES]
      .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
      .flatMap((i) => {
        const o = overrides[i.id];
        if (!o || i.source === "live") return [i];
        const st = toMapStatus(o);
        return st ? [{ ...i, status: st }] : []; // rejected demo issues are hidden
      });
  }, [live, localDemo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allIssues
      .map((issue, key) => ({ issue, key }))
      .filter(({ issue }) => {
        if (category !== "ALL" && issue.category !== category) return false;
        if (severity !== "ALL" && issue.severity !== severity) return false;
        if (status !== "ALL" && issue.status !== status) return false;
        if (q && ![issue.title, issue.id, issue.location].some((v) => v.toLowerCase().includes(q)))
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.issue.severity) - SEVERITY_ORDER.indexOf(b.issue.severity),
      );
  }, [allIssues, category, severity, status, query]);

  const selected = filtered.find((f) => f.key === selectedKey)?.issue ?? null;
  const WORK_OFFSET = 100000;
  const mappedWork = work
    .map((w, i) => ({ w, key: WORK_OFFSET + i }))
    .filter(({ w }) => w.latitude !== null && w.longitude !== null);
  const selectedWork =
    selectedKey !== null && selectedKey >= WORK_OFFSET
      ? (work[selectedKey - WORK_OFFSET] ?? null)
      : null;

  const markers: MapMarker[] = useMemo(
    () =>
      filtered.map(({ issue, key }) => ({
        id: key,
        latitude: issue.latitude,
        longitude: issue.longitude,
        title: `${issue.id} · ${issue.title}`,
        lines: [
          `${cap(issue.severity)} · ${MAP_STATUS_LABELS[issue.status]}`,
          SOURCE_LABELS[issue.source],
        ],
        tone: issue.severity.toLowerCase(),
      })),
    [filtered],
  );
  const allMarkers: MapMarker[] = showWork
    ? [
        ...markers,
        ...mappedWork.map(({ w, key }) => ({
          id: key,
          latitude: w.latitude as number,
          longitude: w.longitude as number,
          title: `${w.id} · ${w.title}`,
          lines: [`Maintenance · ${WORK_STATUS_LABELS[w.status]}`, "SAMPLE / DEMO WORK"],
          tone: `work-${w.status.toLowerCase().replace("_", "")}`,
        })),
      ]
    : markers;
  const heatPoints: HeatPoint[] = useMemo(
    () =>
      filtered.map(
        ({ issue }) =>
          [
            issue.latitude,
            issue.longitude,
            4 - SEVERITY_ORDER.indexOf(issue.severity),
          ] as HeatPoint,
      ),
    [filtered],
  );
  const hotspotCircles: MapHotspot[] = useMemo(
    () =>
      hotspots.map((h) => ({
        id: h.cluster_id,
        latitude: h.latitude,
        longitude: h.longitude,
        radiusM: h.radius_m,
        reportCount: h.report_count,
        label: `Severity score ${h.severity_score}`,
      })),
    [hotspots],
  );
  const hotspotsAvailable = hotspotCircles.length > 0;

  const filtersActive =
    category !== "ALL" || severity !== "ALL" || status !== "ALL" || query !== "";
  function clearFilters() {
    setCategory("ALL");
    setSeverity("ALL");
    setStatus("ALL");
    setQuery("");
  }

  const counts = {
    sample: allIssues.filter((i) => i.source === "sample").length,
    demo: localDemo.length,
    live: live.length,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-5 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">Issues map</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Drainage Issues Map</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Click a marker or a list item to see details. No personal details of reporters are
              shown.
            </p>
          </div>
          <Link
            to="/report"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <MapPin className="size-4" /> Report an issue
          </Link>
        </div>

        <p className="mt-4 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-amber-500">Demo map:</span> {counts.sample} SAMPLE
          records at illustrative locations (not real reports, not verified)
          {counts.demo > 0 && ` · ${counts.demo} demo reports saved in this browser`}
          {counts.live > 0
            ? ` · ${counts.live} live reports from the server`
            : " · live server data unavailable"}
          .
        </p>

        <BackendWarning demoNote="Live reports can't be loaded, so the map shows sample and browser-saved demo records only." />

        {/* Filters */}
        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm sm:col-span-2 lg:col-span-2">
            <span className="mb-1 block font-medium text-muted-foreground">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value.slice(0, 100))}
                placeholder="Title, report ID or location"
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </span>
          </label>
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={MAP_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <FilterSelect
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={SEVERITY_ORDER.map((s) => ({ value: s, label: cap(s) }))}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={(Object.keys(MAP_STATUS_LABELS) as MapIssueStatus[]).map((s) => ({
              value: s,
              label: MAP_STATUS_LABELS[s],
            }))}
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showHeat}
                onChange={(e) => setShowHeat(e.target.checked)}
              />
              Heatmap
            </label>
            <label
              className={`flex items-center gap-2 text-sm ${hotspotsAvailable ? "" : "opacity-60"}`}
            >
              <input
                type="checkbox"
                checked={showHotspots && hotspotsAvailable}
                disabled={!hotspotsAvailable}
                onChange={(e) => setShowHotspots(e.target.checked)}
              />
              Hotspot clusters
              {!hotspotsAvailable && (
                <span className="text-xs text-muted-foreground">
                  (unavailable — needs live server data)
                </span>
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showWork}
                onChange={(e) => setShowWork(e.target.checked)}
              />
              Maintenance work
            </label>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!filtersActive}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:border-primary disabled:opacity-50"
            >
              <X className="size-4" /> Clear all filters
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setBasemap(o.value)}
                aria-pressed={basemap === o.value}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${basemap === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <ul
            aria-label="Severity legend"
            className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
          >
            {SEVERITY_ORDER.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block size-3 rounded-full"
                  style={{ backgroundColor: SEVERITY_COLORS[s] }}
                />
                {cap(s)}
              </li>
            ))}
            {showWork &&
              WORK_STATUS_ORDER.map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-3 rotate-45 rounded-[2px]"
                    style={{ backgroundColor: WORK_STATUS_COLORS[s] }}
                  />
                  Work: {WORK_STATUS_LABELS[s]}
                </li>
              ))}
          </ul>
        </div>
        {basemap === "google" && !hasGoogleMapsKey && (
          <p className="mt-3 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
            Google Maps is not set up yet (needs VITE_GOOGLE_MAPS_API_KEY). Switch to Leaflet GIS to
            use the map now.
          </p>
        )}

        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="relative h-[420px] overflow-hidden rounded-xl border border-border sm:h-[540px]">
            {basemap === "google" ? (
              <LazyGoogleMap
                center={[28.6139, 77.209]}
                zoom={12}
                markers={allMarkers}
                heatPoints={heatPoints}
                showHeat={showHeat}
                {...(showHotspots && hotspotsAvailable ? { hotspots: hotspotCircles } : {})}
                onSelectMarker={(id) => setSelectedKey(id)}
              />
            ) : (
              <LazyMap
                latitude={null}
                longitude={null}
                zoom={12}
                markers={allMarkers}
                heatPoints={heatPoints}
                showHeat={showHeat}
                {...(showHotspots && hotspotsAvailable ? { hotspots: hotspotCircles } : {})}
                selectedId={selectedKey}
                onMarkerClick={(id) => setSelectedKey(id)}
                label="Loading city map…"
              />
            )}
            {selectedWork && (
              <aside
                role="dialog"
                aria-label={`Work details for ${selectedWork.id}`}
                className="absolute inset-x-2 bottom-2 z-[1000] max-h-[55%] sm:max-h-[70%] overflow-y-auto rounded-xl border border-border bg-card/95 p-4 text-sm shadow-lg backdrop-blur sm:inset-x-auto sm:right-3 sm:bottom-3 sm:w-80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full border border-amber-500/50 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                      {selectedWork.source === "sample" ? "SAMPLE WORK" : "ADMIN DEMO WORK"}
                    </span>
                    <h2 className="mt-2 font-semibold">{selectedWork.title}</h2>
                    <p className="font-mono text-xs text-muted-foreground">
                      {selectedWork.id} · {selectedWork.type}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(null)}
                    aria-label="Close details"
                    className="rounded p-1 hover:bg-secondary"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <p
                  className="mt-2 text-xs font-semibold"
                  style={{ color: WORK_STATUS_COLORS[selectedWork.status] }}
                >
                  {WORK_STATUS_LABELS[selectedWork.status]}
                </p>
                <p className="mt-1 text-xs">{selectedWork.location}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedWork.team} · due{" "}
                  {new Date(selectedWork.expected_completion).toLocaleDateString()}
                </p>
                {selectedWork.related_issue_id && (
                  <p className="text-xs text-muted-foreground">
                    Related issue {selectedWork.related_issue_id}
                  </p>
                )}
                <p className="mt-2 text-xs leading-relaxed">{selectedWork.description}</p>
                <Link
                  to="/maintenance"
                  className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
                >
                  Open maintenance tracker
                </Link>
              </aside>
            )}
            {selected && (
              <aside
                role="dialog"
                aria-label={`Details for ${selected.id}`}
                className="absolute inset-x-2 bottom-2 z-[1000] max-h-[55%] sm:max-h-[70%] overflow-y-auto rounded-xl border border-border bg-card/95 p-4 text-sm shadow-lg backdrop-blur sm:inset-x-auto sm:right-3 sm:bottom-3 sm:w-80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <SourceBadge source={selected.source} />
                    <h2 className="mt-2 font-semibold">{selected.title}</h2>
                    <p className="font-mono text-xs text-muted-foreground">{selected.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(null)}
                    aria-label="Close details"
                    className="rounded p-1 hover:bg-secondary"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Severity</dt>
                    <dd
                      className="font-semibold"
                      style={{ color: SEVERITY_COLORS[selected.severity] }}
                    >
                      {cap(selected.severity)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-semibold">{MAP_STATUS_LABELS[selected.status]}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>{selected.category}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Location</dt>
                    <dd>{selected.location}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Reported</dt>
                    <dd>
                      {selected.reported_at ? new Date(selected.reported_at).toLocaleString() : "—"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-relaxed">{selected.description}</p>
              </aside>
            )}
          </div>

          <section
            aria-label="Matching issues"
            className="flex max-h-[540px] flex-col rounded-xl border border-border bg-card"
          >
            <header className="border-b border-border px-4 py-3 text-sm font-semibold">
              {loading
                ? "Loading…"
                : `${filtered.length} ${filtered.length === 1 ? "issue" : "issues"} found`}
            </header>
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <p>No issues match these filters.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 font-semibold text-primary hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto">
                {filtered.map(({ issue, key }) => (
                  <li key={issue.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKey(key);
                        if (basemap === "google" && !hasGoogleMapsKey) setBasemap("leaflet");
                      }}
                      aria-pressed={selectedKey === key}
                      className={`flex w-full gap-3 border-b border-border px-4 py-3 text-left text-sm transition hover:bg-secondary/60 ${selectedKey === key ? "bg-primary/10" : ""}`}
                    >
                      <span
                        aria-hidden
                        className="mt-1 inline-block size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: SEVERITY_COLORS[issue.severity] }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{issue.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {issue.id} · {issue.location}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {cap(issue.severity)} · {MAP_STATUS_LABELS[issue.status]}
                          <SourceBadge source={issue.source} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        {!backendOnline && !loading && (
          <p className="mt-4 text-xs text-muted-foreground">
            The live report server isn't reachable right now, so only sample and browser-saved demo
            records are shown.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
