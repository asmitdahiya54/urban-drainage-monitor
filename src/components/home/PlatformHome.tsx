import { ClientOnly, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertOctagon,
  BarChart3,
  Box,
ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  CloudSun,
  Info,
  Compass,
  Construction,
  Droplets,
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
import type { CityData, CityLayers, CityZone } from "@/components/city/types";
import { useAuth } from "@/context/AuthContext";
import {
  rainfallLevel,
  type FeedItem,
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
  return (
    <>
      {shown}
      {suffix}
    </>
  );
}

const RISK_TONE = { HIGH: "high", MEDIUM: "medium", LOW: "low" } as const;
const barTone = (v: number) =>
  v >= 65 ? "bg-risk-high" : v >= 45 ? "bg-risk-medium" : "bg-risk-low";

function CityOverview({ data }: { data: CityData }) {
  if (data.source !== "live" || !data.summary) {
    return <p className="py-4 text-sm text-city-muted">No verified citizen report statistics available.</p>;
  }
  const summary = data.summary;
  const stats = [
    { label: "Total Issues", value: summary.total },
    { label: "Critical", value: summary.high_severity },
    { label: "Resolved", value: summary.resolved },
  ];
  return (
    <>
      <PanelTitle icon={Activity}>City Overview</PanelTitle>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {stats.map((item) => (
          <div key={item.label}>
            <dt className="text-[11px] text-city-muted">{item.label}</dt>
            <dd className="text-lg font-semibold"><CountUp value={item.value} /></dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] text-city-muted">Based on public citizen reports.</p>
    </>
  );
}
function WeatherCard({ weather }: { weather: WeatherData | null }) {
  if (!weather) return <p className="py-4 text-sm text-city-muted">Live weather data unavailable.</p>;
  const level = rainfallLevel(weather.rainfall);
  const ring =
    level === "heavy"
      ? "ring-1 ring-risk-high/50"
      : level === "moderate"
        ? "ring-1 ring-risk-medium/40"
        : "";
  return (
    <div className={`-m-1 rounded-lg p-1 ${ring}`}>
      <div className="flex items-center gap-4">
        <CloudSun className="size-10 shrink-0 text-city-cyan" />
        <div>
          <p className="dash-label flex items-center gap-2">
            {weather.location}
            {weather.isDemo && (
              <span className="rounded-full border border-risk-medium/40 px-1.5 text-[9px] text-risk-medium">
                DEMO
              </span>
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
      <p
        className={`mt-2 text-[10px] ${level === "low" ? "text-city-muted" : level === "heavy" ? "text-risk-high" : "text-risk-medium"}`}
      >
        {level === "heavy"
          ? "Heavy rainfall warning"
          : level === "moderate"
            ? "Moderate rainfall  -  elevated drainage watch"
            : "Normal conditions"}
        {weather.isDemo && "  |  Demo weather data, not actual current weather"}
      </p>
    </div>
  );
}

function RiskPrediction({ risk }: { risk: PublicRiskAreas | null }) {
  const areas = risk?.areas ?? [];
  if (!areas.length) {
    return <p className="py-4 text-sm text-city-muted">No risk-area data is currently available.</p>;
  }
  const avg = areas.reduce((sum, area) => sum + area.risk_score, 0) / areas.length;
  const score = Math.round(avg <= 1 ? avg * 100 : avg);
  const level = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
  const tone = RISK_TONE[level];
  return (
    <>
      <div className="flex items-center gap-2">
        <Brain className="size-6 text-city-cyan" />
        <div>
          <h2 className="text-sm font-semibold">Reported Area Risk</h2>
          <p className="text-[11px] text-city-muted">Derived from available risk-area data; not a validated prediction.</p>
        </div>
      </div>
      <p className={`mt-4 text-2xl font-semibold ${TONE_TEXT[tone]}`}>{level}</p>
      <p className="text-sm text-city-muted">Risk score: {score}/100</p>
      <p className="mt-2 text-[10px] text-city-muted">{RISK_DISCLAIMER}</p>
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
    minutesAgo: r.created_at
      ? Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000))
      : 0,
    status: STATUS_LABELS[r.status],
    isDemo: false,
  };
}

function LiveFeed({ reports }: { reports: MapReport[] }) {
  const items = useMemo(
    () => [...reports].sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    ).slice(0, 5).map(liveToFeed),
    [reports]
  );
  const [selected, setSelected] = useState<FeedItem | null>(null);
  return (
    <>
      <div className="flex items-center gap-2">
        <PanelTitle icon={Radio}>Citizen Report Feed</PanelTitle>
        <DataBadge live={items.length > 0} />
      </div>
      {selected ? (
        <div className="mt-3 text-xs">
          <p className="font-semibold">{selected.issue}</p>
          <p className="mt-1 text-city-muted">{selected.location}  |  {selected.status}</p>
          <button className="mt-2 text-city-cyan" onClick={() => setSelected(null)}>Back to reports</button>
        </div>
      ) : items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button className="w-full rounded-lg border border-city-line/60 p-2 text-left text-xs" onClick={() => setSelected(item)}>
                <span className="font-medium">{item.issue}  |  {item.location}</span>
                <span className="block text-city-muted">{agoLabel(item.minutesAgo)}  |  {item.status}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-city-muted">No citizen reports are available yet.</p>
      )}
    </>
  );
}
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-md p-1 text-city-muted hover:text-city-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-city-muted">Reports</dt>
          <dd className="font-semibold">{zone.reportCount}</dd>
        </div>
        <div>
          <dt className="text-city-muted">Unresolved</dt>
          <dd className="font-semibold">{zone.unresolvedCount}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-city-muted">
        {zone.source === "live" ? "From live public reports." : "Demonstration sector."}
      </p>
      <Link
        to="/map"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-city-cyan hover:text-city-cyan-bright"
      >
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
  const controls = useRef<OrbitControlsImpl | null>(null);
  const [risk, setRisk] = useState<PublicRiskAreas | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

useEffect(() => {
  let active = true;

  const fetchWeather = async () => {
    try {
      const params = new URLSearchParams({
        latitude: "28.2470",
        longitude: "77.0650",
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "precipitation",
          "weather_code",
          "wind_speed_10m",
        ].join(","),
        hourly: "precipitation_probability,visibility",
        forecast_days: "1",
        timezone: "Asia/Kolkata",
      });

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params}`
      );

      if (!response.ok) {
        throw new Error("Weather service unavailable");
      }

      const result = await response.json();

      const current = result.current;
      const hourly = result.hourly;

      const hourIndex = hourly.time.indexOf(current.time);

      const weatherConditions: Record<number, string> = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snowfall",
        73: "Moderate snowfall",
        75: "Heavy snowfall",
        80: "Rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Severe thunderstorm with hail",
      };

      if (active) {
        setWeather({
          location: "Sohna, Haryana",
          temperature: Math.round(current.temperature_2m),
          condition:
            weatherConditions[current.weather_code] ?? "Unknown conditions",
          humidity: current.relative_humidity_2m,
          rainfall: current.precipitation,
          windSpeed: current.wind_speed_10m,
          rainProbability:
            hourIndex >= 0
              ? hourly.precipitation_probability[hourIndex] ?? 0
              : 0,
          visibility:
            hourIndex >= 0
              ? Number(
                  (hourly.visibility[hourIndex] / 1000).toFixed(1)
                )
              : 0,
          timestamp: current.time,
          isDemo: false,
        });
      }
    } catch (error) {
      console.error("Live weather fetch failed:", error);
    }
  };

  fetchWeather();

  const interval = window.setInterval(fetchWeather, 10 * 60 * 1000);

  return () => {
    active = false;
    window.clearInterval(interval);
  };
}, []);

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
        The interactive city needs WebGL, which this browser does not support. All dashboard data is
        still shown below.
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



  const controlsCard = (
    <div className="flex items-center gap-2">


      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className="dash-round size-9"
          aria-label="Zoom in"
          onClick={() => zoom(0.8)}
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          className="dash-round size-9"
          aria-label="Zoom out"
          onClick={() => zoom(1.25)}
        >
          <Minus className="size-4" />
        </button>
      </div>
      <button
        type="button"
        className="dash-round size-8"
        aria-label="Reset view"
        onClick={() => {
          setSelectedZone(null);
          setResetNonce((n) => n + 1);
        }}
      >
        <RotateCcw className="size-4" />
      </button>
      <Link
        to="/city"
        className="dash-round size-9 text-xs font-semibold text-city-cyan"
        aria-label="Open full 3D city"
      >
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
        <Link to="/community" className="dash-btn-ghost">
  <ClipboardList className="size-4" /> Propose an Activity
</Link>
      </div>
    </div>
  );

  const actionBar = (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map(({ to, title, text, icon: Icon }) => (
        <Link
          key={title}
          to={to}
          className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-city-cyan/10"
        >
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
        <section
          className="relative hidden min-h-[calc(100svh-4.5rem)] overflow-hidden lg:block"
          aria-label="City intelligence dashboard"
        >
          <div className="absolute inset-0">{isDesktop === true && cityCanvas}</div>
          <div className="pointer-events-none absolute inset-0 bg-dash-vignette" />
          <div className="pointer-events-none relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-[92rem] grid-cols-[25rem_1fr_22rem] gap-4 p-4">
            <div className="flex flex-col gap-3">
              <div className="pointer-events-auto">{hero}</div>
              <Panel delay={0.1} label="City overview">
                <CityOverview data={data} />
              </Panel>

            </div>
            <div className="flex flex-col items-center justify-between">
              <Panel delay={0.15} className="w-full max-w-lg" label="Live weather">
                <WeatherCard weather={weather} />
              </Panel>
              <div className="flex flex-col items-center gap-4">
                <AnimatePresence>
                  {selectedZone && (
                    <ZoneCard zone={selectedZone} onClose={() => setSelectedZone(null)} />
                  )}
                </AnimatePresence>
                <Panel delay={0.35} className="w-full max-w-2xl" label="Quick actions">
                  {actionBar}
                </Panel>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Panel delay={0.1} label="Drainage risk prediction">
                <RiskPrediction risk={risk} />
              </Panel>
              <Panel delay={0.2} label="Live feed">
                <LiveFeed reports={data.reports} />
              </Panel>

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
          <Panel label="Drainage risk prediction">
            <RiskPrediction risk={risk} />
          </Panel>
          <Panel label="City overview">
            <CityOverview data={data} />
          </Panel>
          <Panel label="Live weather">
            <WeatherCard weather={weather} />
          </Panel>
            <Panel label="Live feed">
  <LiveFeed reports={data.reports} />
</Panel>

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
