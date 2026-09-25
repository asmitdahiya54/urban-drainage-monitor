import { ClientOnly, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  BarChart3,
  Box,
  Brain,
  CheckCircle2,
  ClipboardList,
  CloudOff,
  Compass,
  Construction,
  Droplets,
  Layers3,
  Leaf,
  Minus,
  PenSquare,
  Plus,
  Radio,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Switch } from "@/components/ui/switch";
import type { CityData, CityLayers, CityZone } from "@/components/city/types";
import { useAuth } from "@/context/AuthContext";
import {
  ISSUE_TYPE_LABELS,
  publicMapApi,
  RISK_DISCLAIMER,
  STATUS_LABELS,
  type MapReport,
  type PublicRiskAreas,
} from "@/services/api";

const DashboardCity = lazy(() => import("./DashboardCity"));

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Date unknown";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function feedTone(report: MapReport): "high" | "medium" | "low" {
  if (report.status === "RESOLVED") return "low";
  if (report.severity === "HIGH" || report.severity === "CRITICAL") return "high";
  return "medium";
}

const TONE_TEXT = { high: "text-risk-high", medium: "text-risk-medium", low: "text-risk-low" };
const TONE_BG = { high: "bg-risk-high/15", medium: "bg-risk-medium/15", low: "bg-risk-low/15" };

function Panel({
  className = "",
  delay = 0,
  children,
  label,
}: {
  className?: string;
  delay?: number;
  children: React.ReactNode;
  label?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      aria-label={label}
      initial={{ opacity: 0, y: reduced ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.55, delay: reduced ? 0 : delay }}
      className={`dash-panel pointer-events-auto ${className}`}
    >
      {children}
    </motion.section>
  );
}

function PanelTitle({ icon: Icon, children }: { icon: typeof Droplets; children: string }) {
  return (
    <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-city-foreground">
      <Icon className="size-4 text-city-cyan" />
      {children}
    </h2>
  );
}

function CityOverview({ data }: { data: CityData }) {
  const live = data.source === "live";
  const inProgress = live
    ? data.reports.filter((r) => r.status === "IN_PROGRESS" || r.status === "ASSIGNED").length
    : undefined;
  const stats = [
    { label: "Total Issues", value: data.summary?.total, icon: ClipboardList, tone: "text-city-cyan bg-city-cyan/15" },
    { label: "Critical", value: data.summary?.high_severity, icon: AlertOctagon, tone: "text-risk-high bg-risk-high/15" },
    { label: "In Progress", value: inProgress, icon: Construction, tone: "text-risk-medium bg-risk-medium/15" },
    { label: "Resolved", value: data.summary?.resolved, icon: CheckCircle2, tone: "text-risk-low bg-risk-low/15" },
  ];
  return (
    <>
      <PanelTitle icon={Activity}>City Overview</PanelTitle>
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="size-4" />
            </span>
            <div>
              <dt className="text-[11px] text-city-muted">{label}</dt>
              <dd className="text-lg font-semibold leading-tight tabular-nums">
                {value ?? "—"}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      {!live && (
        <p className="mt-3 text-[11px] text-city-muted">Live totals unavailable right now.</p>
      )}
    </>
  );
}

function WeatherCard() {
  return (
    <div className="flex items-center gap-4">
      <CloudOff className="size-9 shrink-0 text-city-cyan" />
      <div>
        <p className="dash-label">Live Weather</p>
        <p className="mt-1 text-sm font-semibold">Weather data unavailable</p>
        <p className="text-[11px] text-city-muted">No weather service is connected yet.</p>
      </div>
      <dl className="ml-auto hidden gap-5 text-center sm:flex">
        {["Humidity", "Rainfall", "Wind"].map((label) => (
          <div key={label}>
            <dt className="text-[11px] text-city-muted">{label}</dt>
            <dd className="mt-1 text-sm font-semibold">—</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RiskPrediction({ risk, error }: { risk: PublicRiskAreas | null; error: boolean }) {
  const areas = risk?.areas ?? [];
  const high = areas.filter((a) => a.risk_level === "HIGH").length;
  const pct = areas.length ? Math.round((high / areas.length) * 100) : null;
  const top = [...areas].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  return (
    <>
      <div className="flex items-start gap-3">
        <Brain className="mt-0.5 size-6 text-city-cyan" />
        <div>
          <h2 className="text-sm font-semibold">Drainage Risk Prediction</h2>
          <p className="text-[11px] text-city-muted">Prototype analysis of crowdsourced report data</p>
        </div>
      </div>
      {areas.length === 0 ? (
        <p className="mt-5 text-sm text-city-muted">
          {error ? "Risk prediction unavailable right now." : "No risk predictions yet."}
        </p>
      ) : (
        <div className="mt-4 flex items-center gap-5">
          <div className="relative size-28 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90">
              <circle cx="50" cy="50" r={radius} className="fill-none stroke-city-line" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="fill-none stroke-risk-high"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - (pct ?? 0) / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-city-muted">High Risk</span>
              <span className="text-2xl font-semibold tabular-nums">{pct}%</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-city-muted">Top Risk Areas</p>
            <ol className="mt-2 space-y-1.5 text-xs">
              {top.map((area, i) => {
                const tone = area.risk_level === "HIGH" ? "high" : area.risk_level === "MEDIUM" ? "medium" : "low";
                return (
                  <li key={`${area.latitude}-${area.longitude}`} className="flex items-center gap-2">
                    <span className="flex size-4 items-center justify-center rounded-full bg-city-surface text-[10px]">
                      {i + 1}
                    </span>
                    <span className="truncate tabular-nums">
                      {area.latitude.toFixed(3)}, {area.longitude.toFixed(3)}
                    </span>
                    <span className={`ml-auto shrink-0 ${TONE_TEXT[tone]}`}>
                      {area.risk_level.charAt(0) + area.risk_level.slice(1).toLowerCase()}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
      <p className="mt-3 text-[10px] leading-snug text-city-muted">{RISK_DISCLAIMER}</p>
    </>
  );
}

function LiveFeed({ reports }: { reports: MapReport[] }) {
  const recent = useMemo(
    () =>
      [...reports]
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        .slice(0, 4),
    [reports],
  );
  return (
    <>
      <PanelTitle icon={Radio}>Live Feed</PanelTitle>
      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-city-muted">No recent reports</p>
      ) : (
        <ul className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {recent.map((report) => {
              const tone = feedTone(report);
              const Icon = tone === "low" ? CheckCircle2 : tone === "high" ? AlertOctagon : Droplets;
              return (
                <motion.li
                  key={report.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 rounded-lg border border-city-line/60 bg-city/50 px-3 py-2"
                >
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {ISSUE_TYPE_LABELS[report.issue_type] ?? report.issue_type} ·{" "}
                      {STATUS_LABELS[report.status]}
                    </p>
                    <p className="text-[11px] text-city-muted">
                      Report #{report.id} · {timeAgo(report.created_at)}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </>
  );
}

const NETWORK = [
  { label: "Main Pipes", value: 98, bar: "bg-city-cyan" },
  { label: "Secondary Pipes", value: 87, bar: "bg-city-cyan-bright" },
  { label: "Flow Capacity", value: 76, bar: "bg-risk-medium" },
];

function DrainageNetworkCard() {
  return (
    <>
      <PanelTitle icon={Droplets}>Underground Drainage Network</PanelTitle>
      <ul className="mt-3 space-y-2.5">
        {NETWORK.map((row) => (
          <li key={row.label} className="flex items-center gap-3 text-xs">
            <span className="w-28 text-city-muted">{row.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-city-surface">
              <span className={`block h-full rounded-full ${row.bar}`} style={{ width: `${row.value}%` }} />
            </span>
            <span className="w-9 text-right tabular-nums">{row.value}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-city-muted">Sample values — no pipe sensors connected.</p>
    </>
  );
}

type LayerKey = "drainage" | "risk" | "heat" | "buildings" | "roads";
const LAYER_ROWS: { key: LayerKey; label: string }[] = [
  { key: "drainage", label: "Drainage Network" },
  { key: "risk", label: "Issue Markers" },
  { key: "heat", label: "Risk Heatmap" },
  { key: "buildings", label: "Building Footprints" },
  { key: "roads", label: "Roads & Water Bodies" },
];

function ZoneCard({ zone, onClose }: { zone: CityZone; onClose: () => void }) {
  const tone = zone.risk === "HIGH" ? "high" : zone.risk === "MEDIUM" ? "medium" : "low";
  return (
    <div className="dash-panel pointer-events-auto w-72">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`dash-label ${TONE_TEXT[tone]}`}>{zone.risk} risk</p>
          <h3 className="mt-1 text-base font-semibold">{zone.issue}</h3>
          <p className="text-xs text-city-muted">{zone.name}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded-md p-1 text-city-muted hover:text-city-foreground">
          <X className="size-4" />
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-city-muted">Reports</dt><dd className="font-semibold">{zone.reportCount}</dd></div>
        <div><dt className="text-city-muted">Unresolved</dt><dd className="font-semibold">{zone.unresolvedCount}</dd></div>
      </dl>
      <p className="mt-2 text-[11px] text-city-muted">
        {zone.source === "live" ? "From live public reports." : "Demonstration sector."}
      </p>
      <Link to="/map" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-city-cyan hover:text-city-cyan-bright">
        Open issues map <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

export function PlatformHome({ data }: { data: CityData }) {
  const reducedMotion = Boolean(useReducedMotion());
  const { isAuthenticated, isAdmin } = useAuth();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [layers, setLayers] = useState<CityLayers>({
    buildings: true,
    drainage: true,
    risk: true,
    heat: true,
    roads: true,
  });
  const [selectedZone, setSelectedZone] = useState<CityZone | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);
  const [heading, setHeading] = useState(0);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const [risk, setRisk] = useState<PublicRiskAreas | null>(null);
  const [riskError, setRiskError] = useState(false);

  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setWebgl(supportsWebGL());
    let active = true;
    publicMapApi
      .riskAreas()
      .then((r) => active && setRisk(r))
      .catch(() => active && setRiskError(true));
    return () => {
      active = false;
    };
  }, []);

  const onControlsReady = useCallback((c: OrbitControlsImpl | null) => {
    controls.current = c;
    if (!c) return;
    const update = () => setHeading((c.getAzimuthalAngle() * 180) / Math.PI);
    c.addEventListener("change", update);
  }, []);

  const zoom = (factor: number) => {
    const c = controls.current;
    if (!c) return;
    const cam = c.object;
    const offset = cam.position.clone().sub(c.target).multiplyScalar(factor);
    const len = Math.min(42, Math.max(10, offset.length()));
    cam.position.copy(c.target.clone().add(offset.setLength(len)));
    c.update();
  };

  const trackTo = isAdmin ? "/admin" : isAuthenticated ? "/reports" : "/map";
  const analyzeTo = isAdmin ? "/admin" : isAuthenticated ? "/dashboard" : "/map";
  const actions = [
    { to: "/report", title: "Report", text: "Share drainage issues", icon: PenSquare },
    { to: analyzeTo, title: "Analyze", text: "GIS + AI insights", icon: BarChart3 },
    { to: trackTo, title: "Track", text: "Real-time updates", icon: Activity },
    { to: "/about", title: "Improve", text: "Cleaner, safer cities", icon: Leaf },
  ] as const;

  const cityCanvas =
    webgl === false ? (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-city-muted">
        The interactive city needs WebGL, which this browser does not support. All dashboard data
        is still shown below.
      </div>
    ) : (
      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          {webgl && (
            <DashboardCity
              zones={data.zones}
              layers={layers}
              selectedZone={selectedZone}
              focusNonce={focusNonce}
              resetNonce={resetNonce}
              reducedMotion={reducedMotion}
              onSelect={(zone) => {
                setSelectedZone(zone);
                setFocusNonce((n) => n + 1);
              }}
              onControlsReady={onControlsReady}
            />
          )}
        </Suspense>
      </ClientOnly>
    );

  const layersCard = (
    <>
      <PanelTitle icon={Layers3}>3D Map Layers</PanelTitle>
      <ul className="mt-3 space-y-2.5">
        {LAYER_ROWS.map(({ key, label }) => (
          <li key={key} className="flex items-center justify-between gap-3 text-xs">
            <label htmlFor={`layer-${key}`} className="text-city-foreground/90">{label}</label>
            <Switch
              id={`layer-${key}`}
              checked={layers[key] !== false}
              onCheckedChange={(v) => setLayers((l) => ({ ...l, [key]: v }))}
            />
          </li>
        ))}
      </ul>
    </>
  );

  const controlsCard = (
    <div className="flex items-center gap-2">
      <button type="button" className="dash-round size-14" aria-label="Reset camera heading" onClick={() => setResetNonce((n) => n + 1)}>
        <Compass className="size-6 text-city-cyan transition-transform" style={{ transform: `rotate(${-heading}deg)` }} />
      </button>
      <div className="flex flex-col gap-1.5">
        <button type="button" className="dash-round size-8" aria-label="Zoom in" onClick={() => zoom(0.8)}><Plus className="size-4" /></button>
        <button type="button" className="dash-round size-8" aria-label="Zoom out" onClick={() => zoom(1.25)}><Minus className="size-4" /></button>
      </div>
      <button type="button" className="dash-round size-8" aria-label="Reset view" onClick={() => { setSelectedZone(null); setResetNonce((n) => n + 1); }}>
        <RotateCcw className="size-4" />
      </button>
      <Link to="/city" className="dash-round size-12 text-sm font-semibold text-city-cyan" aria-label="Open full 3D city">
        3D
      </Link>
    </div>
  );

  const hero = (
    <div>
      <h1 className="text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-[2.1rem] xl:text-[2.4rem]">
        A Smarter Way to
        <br />
        <span className="text-gradient-city">Build Cleaner, Healthier Cities</span>
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-city-muted">
        Real-time drainage monitoring, citizen reports, and AI-powered insights for a flood-free
        tomorrow.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/report" className="dash-btn-primary">
          Report an Issue <ArrowRight className="size-4" />
        </Link>
        <Link to="/city" className="dash-btn-ghost">
          <Box className="size-4" /> Explore 3D City
        </Link>
      </div>
    </div>
  );

  const actionBar = (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map(({ to, title, text, icon: Icon }) => (
        <Link key={title} to={to} className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-city-cyan/10">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-city-cyan/15 text-city-cyan">
            <Icon className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block text-[11px] text-city-muted">{text}</span>
          </span>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="dark flex min-h-screen flex-col bg-dash text-city-foreground">
      <SiteNav variant="dashboard" />
      <main className="flex-1">
        {/* Desktop: city as centerpiece with floating panels */}
        <section className="relative hidden h-[calc(100svh-4.5rem)] min-h-[46rem] overflow-hidden lg:block" aria-label="City intelligence dashboard">
          <div className="absolute inset-0">{isDesktop === true && cityCanvas}</div>
          <div className="pointer-events-none absolute inset-0 bg-dash-vignette" />
          <div className="pointer-events-none absolute inset-0 mx-auto grid max-w-[92rem] grid-cols-[25rem_1fr_22rem] gap-4 p-4">
            <div className="flex flex-col gap-3">
              <div className="pointer-events-auto">{hero}</div>
              <Panel delay={0.1} label="City overview"><CityOverview data={data} /></Panel>
              <div className="mt-auto flex flex-col gap-5">
                <Panel delay={0.25} label="Underground drainage network"><DrainageNetworkCard /></Panel>
              </div>
            </div>
            <div className="flex flex-col items-center justify-between">
              <Panel delay={0.15} className="w-full max-w-lg" label="Live weather"><WeatherCard /></Panel>
              <div className="flex flex-col items-center gap-4">
                <AnimatePresence>
                  {selectedZone && <ZoneCard zone={selectedZone} onClose={() => setSelectedZone(null)} />}
                </AnimatePresence>
                <Panel delay={0.35} className="w-full max-w-2xl" label="Quick actions">{actionBar}</Panel>
              </div>
            </div>
            <div className="flex flex-col gap-3 overflow-hidden">
              <Panel delay={0.1} label="Drainage risk prediction"><RiskPrediction risk={risk} error={riskError} /></Panel>
              <Panel delay={0.2} label="Live feed"><LiveFeed reports={data.reports} /></Panel>
              <Panel delay={0.3} label="3D map layers">{layersCard}</Panel>
              <div className="pointer-events-auto mt-auto flex justify-end">{controlsCard}</div>
            </div>
          </div>
        </section>

        {/* Tablet / mobile: stacked dashboard */}
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 lg:hidden">
          {hero}
          <div className="relative h-[26rem] overflow-hidden rounded-xl border border-city-line">
            {isDesktop === false && cityCanvas}
            <div className="absolute bottom-3 right-3">{controlsCard}</div>
            {selectedZone && (
              <div className="absolute left-3 top-3">
                <ZoneCard zone={selectedZone} onClose={() => setSelectedZone(null)} />
              </div>
            )}
          </div>
          <Panel label="Drainage risk prediction"><RiskPrediction risk={risk} error={riskError} /></Panel>
          <Panel label="City overview"><CityOverview data={data} /></Panel>
          <Panel label="Live weather"><WeatherCard /></Panel>
          <Panel label="Live feed"><LiveFeed reports={data.reports} /></Panel>
          <Panel label="3D map layers">{layersCard}</Panel>
          <Panel label="Underground drainage network"><DrainageNetworkCard /></Panel>
          <Panel label="Quick actions">{actionBar}</Panel>
        </div>

        <section className="border-t border-city-line bg-city-panel/40">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-12 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-city-cyan">
                <ShieldCheck className="size-5" />
                <span className="dash-label">Community action</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold">Spotted a blocked drain?</h2>
              <p className="mt-2 text-sm text-city-muted">
                Every verified report helps make neighbourhood risk visible.
              </p>
            </div>
            <Link to="/report" className="dash-btn-primary">
              Report an Issue <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
