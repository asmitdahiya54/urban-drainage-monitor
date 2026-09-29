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
  CloudSun,
  Info,
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
  demoCityOverview,
  demoCityStatus,
  demoDrainageNetwork,
  demoLiveFeed,
  demoRiskPrediction,
  demoWeather,
  rainfallLevel,
  type FeedItem,
  type RiskPredictionData,
  type WeatherData,
} from "@/data/demoData";
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

function DataBadge({ live }: { live: boolean }) {
  return (
    <span
      className={`ml-auto rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wider ${
        live ? "border-risk-low/40 text-risk-low" : "border-risk-medium/40 text-risk-medium"
      }`}
    >
      {live ? "LIVE DATA" : "DEMO DATA"}
    </span>
  );
}

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return setShown(value);
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <>{shown}{suffix}</>;
}

const RISK_TONE = { HIGH: "high", MEDIUM: "medium", LOW: "low" } as const;
const barTone = (v: number) => (v >= 65 ? "bg-risk-high" : v >= 45 ? "bg-risk-medium" : "bg-risk-low");

function CityOverview({ data }: { data: CityData }) {
  const live = data.source === "live" && Boolean(data.summary);
  const d = demoCityOverview;
  const total = live ? data.summary!.total : d.total;
  const critical = live ? data.summary!.high_severity : d.critical;
  const resolved = live ? data.summary!.resolved : d.resolved;
  const inProgress = live
    ? data.reports.filter((r) => r.status === "IN_PROGRESS" || r.status === "ASSIGNED").length
    : d.inProgress;
  const open = total - resolved;
  const rate = total ? Math.round((resolved / total) * 100) : 0;
  const zones = live ? data.zones.length : d.highRiskZones;
  const stats = [
    { label: "Total Issues", value: total, icon: ClipboardList, tone: "text-city-cyan bg-city-cyan/15" },
    { label: "Critical", value: critical, icon: AlertOctagon, tone: "text-risk-high bg-risk-high/15" },
    { label: "In Progress", value: inProgress, icon: Construction, tone: "text-risk-medium bg-risk-medium/15" },
    { label: "Resolved", value: resolved, icon: CheckCircle2, tone: "text-risk-low bg-risk-low/15" },
  ];
  return (
    <>
      <div className="flex items-center gap-2">
        <PanelTitle icon={Activity}>City Overview</PanelTitle>
        <DataBadge live={live} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="size-4" />
            </span>
            <div>
              <dt className="text-[11px] text-city-muted">{label}</dt>
              <dd className="text-lg font-semibold leading-tight tabular-nums"><CountUp value={value} /></dd>
            </div>
          </div>
        ))}
      </dl>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-city-line/60 pt-3 text-center">
        {[
          { label: "Open Issues", value: open, suffix: "" },
          { label: "Resolution", value: rate, suffix: "%" },
          { label: "Risk Zones", value: zones, suffix: "" },
        ].map((s) => (
          <div key={s.label}>
            <dt className="text-[10px] text-city-muted">{s.label}</dt>
            <dd className="text-sm font-semibold tabular-nums"><CountUp value={s.value} suffix={s.suffix} /></dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] text-city-muted">
        {live ? "Live public reports" : "Demo data • Updated just now"}
      </p>
    </>
  );
}

function WeatherCard({ weather = demoWeather }: { weather?: WeatherData }) {
  const level = rainfallLevel(weather.rainfall);
  const ring =
    level === "heavy" ? "ring-1 ring-risk-high/50" : level === "moderate" ? "ring-1 ring-risk-medium/40" : "";
  return (
    <div className={`-m-1 rounded-lg p-1 ${ring}`}>
      <div className="flex items-center gap-4">
        <CloudSun className="size-10 shrink-0 text-city-cyan" />
        <div>
          <p className="dash-label flex items-center gap-2">
            {weather.location}
            {weather.isDemo && (
              <span className="rounded-full border border-risk-medium/40 px-1.5 text-[9px] text-risk-medium">DEMO</span>
            )}
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{weather.temperature}°C</p>
          <p className="text-[11px] text-city-muted">{weather.condition}</p>
        </div>
        <dl className="ml-auto grid grid-cols-3 gap-x-4 gap-y-1 text-center">
          {[
            ["Humidity", `${weather.humidity}%`],
            ["Rainfall", `${weather.rainfall} mm`],
            ["Wind", `${weather.windSpeed} km/h`],
            ["Rain prob.", `${weather.rainProbability}%`],
            ["Visibility", `${weather.visibility} km`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] text-city-muted">{label}</dt>
              <dd className="text-xs font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className={`mt-2 text-[10px] ${level === "low" ? "text-city-muted" : level === "heavy" ? "text-risk-high" : "text-risk-medium"}`}>
        {level === "heavy" ? "Heavy rainfall warning" : level === "moderate" ? "Moderate rainfall — elevated drainage watch" : "Normal conditions"}
        {weather.isDemo && " · Demo weather data, not actual current weather"}
      </p>
    </div>
  );
}

function RiskPrediction({ risk }: { risk: PublicRiskAreas | null }) {
  const areas = risk?.areas ?? [];
  const live = areas.length > 0;
  let p: RiskPredictionData = demoRiskPrediction;
  if (live) {
    const avg = areas.reduce((s, a) => s + a.risk_score, 0) / areas.length;
    const score = Math.round(avg <= 1 ? avg * 100 : avg);
    p = {
      riskScore: score,
      riskLevel: score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW",
      highRiskZones: areas.filter((a) => a.risk_level === "HIGH").length,
      mediumRiskZones: areas.filter((a) => a.risk_level === "MEDIUM").length,
      lowRiskZones: areas.filter((a) => a.risk_level === "LOW").length,
      factors: [],
      predictionTime: new Date().toISOString(),
      isDemo: false,
    };
  }
  const tone = RISK_TONE[p.riskLevel];
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const stroke = tone === "high" ? "stroke-risk-high" : tone === "medium" ? "stroke-risk-medium" : "stroke-risk-low";
  return (
    <>
      <div className="flex items-start gap-3">
        <Brain className="mt-0.5 size-6 text-city-cyan" />
        <div>
          <h2 className="text-sm font-semibold">Drainage Risk Prediction</h2>
          <p className="text-[11px] text-city-muted">Prototype AI Prediction</p>
        </div>
        <DataBadge live={live} />
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative size-24 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r={radius} className="fill-none stroke-city-line" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r={radius}
              className={`fill-none ${stroke}`}
              strokeWidth="8" strokeLinecap="round" strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ * (1 - p.riskScore / 100) }}
              transition={{ duration: 1 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular-nums">{p.riskScore}</span>
            <span className="text-[10px] text-city-muted">/ 100</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="text-[11px] text-city-muted">Overall risk</p>
          <p className={`text-base font-semibold ${TONE_TEXT[tone]}`}>{p.riskLevel}</p>
          <p className="mt-1 text-[11px] text-city-muted">
            {p.highRiskZones + p.mediumRiskZones + p.lowRiskZones} flood-prone zones
          </p>
          <div className="mt-1 flex gap-2 text-[11px]">
            <span className="text-risk-high">{p.highRiskZones} High</span>
            <span className="text-risk-medium">{p.mediumRiskZones} Med</span>
            <span className="text-risk-low">{p.lowRiskZones} Low</span>
          </div>
        </div>
      </div>
      {p.factors.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {p.factors.map((f) => (
            <li key={f.label} className="flex items-center gap-2 text-[11px]">
              <span className="w-32 text-city-muted">{f.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-city-surface">
                <span className={`block h-full rounded-full ${barTone(f.value)}`} style={{ width: `${f.value}%` }} />
              </span>
              <span className="w-8 text-right tabular-nums">{f.value}%</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] leading-snug text-city-muted">
        {p.isDemo
          ? "Demo prediction based on simulated drainage, rainfall and crowd-report data. Risk increases with rainfall intensity, blockage and waterlogging reports, and historical issue density. "
          : ""}
        {RISK_DISCLAIMER}
      </p>
    </>
  );
}

function agoLabel(mins: number) {
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return `${h} hr${h === 1 ? "" : "s"} ago`;
}

function liveToFeed(r: MapReport): FeedItem {
  const tone = feedTone(r);
  return {
    id: String(r.id),
    issue: ISSUE_TYPE_LABELS[r.issue_type] ?? r.issue_type,
    location: `Report #${r.id}`,
    risk: tone === "high" ? "HIGH" : tone === "medium" ? "MEDIUM" : "LOW",
    minutesAgo: r.created_at ? Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000)) : 0,
    status: STATUS_LABELS[r.status],
    isDemo: false,
  };
}

function LiveFeed({ reports }: { reports: MapReport[] }) {
  const live = reports.length > 0;
  const reduced = useReducedMotion();
  const base = useMemo(
    () =>
      live
        ? [...reports]
            .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
            .slice(0, 5)
            .map(liveToFeed)
        : demoLiveFeed,
    [reports, live],
  );
  // Demo feed: gently rotate items in from the top to simulate activity.
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (live || reduced) return;
    const t = window.setInterval(() => setOffset((o) => (o + 1) % base.length), 6000);
    return () => window.clearInterval(t);
  }, [live, reduced, base.length]);
  const items = live ? base : [...base.slice(base.length - offset), ...base.slice(0, base.length - offset)].slice(0, 4);
  const [selected, setSelected] = useState<FeedItem | null>(null);

  return (
    <>
      <div className="flex items-center gap-2">
        <PanelTitle icon={Radio}>Live Feed</PanelTitle>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wider ${live ? "border-risk-low/40 text-risk-low" : "border-risk-medium/40 text-risk-medium"}`}>
          {live ? "LIVE DATA" : "DEMO LIVE FEED"}
        </span>
      </div>
      {selected ? (
        <div className="mt-3 rounded-lg border border-city-line/60 bg-city/50 p-3 text-xs">
          <div className="flex items-start justify-between">
            <p className="font-semibold">{selected.issue}</p>
            <button type="button" aria-label="Close report details" onClick={() => setSelected(null)} className="text-city-muted hover:text-city-foreground">
              <X className="size-3.5" />
            </button>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-1.5">
            <dt className="text-city-muted">Location</dt><dd>{selected.location}</dd>
            <dt className="text-city-muted">Risk</dt><dd className={TONE_TEXT[RISK_TONE[selected.risk]]}>{selected.risk.charAt(0) + selected.risk.slice(1).toLowerCase()}</dd>
            <dt className="text-city-muted">Reported</dt><dd>{agoLabel(selected.minutesAgo)}</dd>
            <dt className="text-city-muted">Status</dt><dd>{selected.status}</dd>
          </dl>
          {selected.isDemo && <p className="mt-2 text-[10px] text-risk-medium">Demo report — not a real citizen submission</p>}
          <Link to="/map" className="mt-2 inline-flex items-center gap-1 font-semibold text-city-cyan hover:text-city-cyan-bright">
            View on Map <ArrowRight className="size-3" />
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
              const tone = RISK_TONE[item.risk];
              const Icon = tone === "low" ? CheckCircle2 : tone === "high" ? AlertOctagon : Droplets;
              return (
                <motion.li key={item.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="flex w-full items-center gap-3 rounded-lg border border-city-line/60 bg-city/50 px-3 py-2 text-left transition-colors hover:border-city-cyan/50"
                  >
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{item.issue} · {item.location}</span>
                      <span className="block text-[11px] text-city-muted">{agoLabel(item.minutesAgo)}</span>
                    </span>
                    <span className={`shrink-0 text-[10px] font-semibold ${TONE_TEXT[tone]}`}>{item.risk}</span>
                  </button>
                </motion.li>
              );
            })}
        </ul>
      )}
    </>
  );
}

function DrainageNetworkCard() {
  const n = demoDrainageNetwork;
  return (
    <>
      <div className="flex items-center gap-2">
        <PanelTitle icon={Droplets}>Underground Drainage Network</PanelTitle>
        <DataBadge live={false} />
      </div>
      <dl className="mt-3 grid grid-cols-5 gap-1 text-center">
        {[
          ["Coverage", `${n.coverage}%`, ""],
          ["Monitored", n.monitored, ""],
          ["Healthy", n.healthy, "text-risk-low"],
          ["Warning", n.warning, "text-risk-medium"],
          ["Critical", n.critical, "text-risk-high"],
        ].map(([label, value, tone]) => (
          <div key={label as string}>
            <dt className="text-[10px] text-city-muted">{label}</dt>
            <dd className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-city-surface">
        <span className="bg-risk-low" style={{ width: `${n.healthyPct}%` }} />
        <span className="bg-risk-medium" style={{ width: `${n.warningPct}%` }} />
        <span className="bg-risk-high" style={{ width: `${n.criticalPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-city-muted">
        <span>Healthy {n.healthyPct}%</span><span>Warning {n.warningPct}%</span><span>Critical {n.criticalPct}%</span>
      </div>
      <p className="mt-2 text-[10px] text-city-muted">Demo infrastructure data — no pipe sensors connected.</p>
    </>
  );
}

function CityStatusCard() {
  return (
    <>
      <div className="flex items-center gap-2">
        <PanelTitle icon={ShieldCheck}>City Status</PanelTitle>
        <span
          title="Some dashboard values are simulated for demonstration. Live integrations will replace these values when connected."
          className="ml-auto flex cursor-help items-center gap-1 rounded-full border border-risk-medium/40 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-risk-medium"
        >
          <Info className="size-3" /> DEMO MODE
        </span>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {demoCityStatus.map((s) => (
          <li key={s.label} className="flex items-center justify-between">
            <span className="text-city-muted">{s.label}</span>
            <span className={`flex items-center gap-1.5 font-medium ${TONE_TEXT[s.tone]}`}>
              <span className={`size-1.5 rounded-full ${s.tone === "low" ? "bg-risk-low" : "bg-risk-medium"}`} />
              {s.value}
            </span>
          </li>
        ))}
      </ul>
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
      .catch(() => active && setRisk(null));
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
        <section className="relative hidden min-h-[calc(100svh-4.5rem)] overflow-hidden lg:block" aria-label="City intelligence dashboard">
          <div className="absolute inset-0">{isDesktop === true && cityCanvas}</div>
          <div className="pointer-events-none absolute inset-0 bg-dash-vignette" />
          <div className="pointer-events-none relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-[92rem] grid-cols-[25rem_1fr_22rem] gap-4 p-4">
            <div className="flex flex-col gap-3">
              <div className="pointer-events-auto">{hero}</div>
              <Panel delay={0.1} label="City overview"><CityOverview data={data} /></Panel>
              <div className="mt-auto flex flex-col gap-5">
                <Panel delay={0.2} label="City status"><CityStatusCard /></Panel>
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
            <div className="flex flex-col gap-3">
              <Panel delay={0.1} label="Drainage risk prediction"><RiskPrediction risk={risk} /></Panel>
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
          <Panel label="Drainage risk prediction"><RiskPrediction risk={risk} /></Panel>
          <Panel label="City overview"><CityOverview data={data} /></Panel>
          <Panel label="Live weather"><WeatherCard /></Panel>
          <Panel label="Live feed"><LiveFeed reports={data.reports} /></Panel>
          <Panel label="3D map layers">{layersCard}</Panel>
          <Panel label="Underground drainage network"><DrainageNetworkCard /></Panel>
          <Panel label="City status"><CityStatusCard /></Panel>
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
