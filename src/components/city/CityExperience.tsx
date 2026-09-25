import { Canvas } from "@react-three/fiber";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Layers3, LocateFixed, RotateCcw, SkipForward, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CityScene } from "./CityScene";
import type { CityData, CityLayers, CityPalette, CityZone } from "./types";

const LOADING_MESSAGES = [
  "Initializing city model…",
  "Loading drainage network…",
  "Loading civic data…",
  "Connecting city intelligence…",
];

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function readPalette(): CityPalette {
  const styles = getComputedStyle(document.documentElement);
  const value = (name: string) => styles.getPropertyValue(name).trim();
  return {
    background: value("--city-render-background"),
    ground: value("--city-render-ground"),
    cyan: value("--city-render-cyan"),
    cyanBright: value("--city-render-cyan-bright"),
    building: value("--city-render-building"),
    high: value("--city-render-high"),
    medium: value("--city-render-medium"),
    low: value("--city-render-low"),
  };
}

function ZonePanel({ zone, onClose }: { zone: CityZone; onClose: () => void }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="pointer-events-auto absolute bottom-20 right-4 w-[min(22rem,calc(100%-2rem))] border border-city-line bg-city-panel/92 p-5 text-city-foreground shadow-city backdrop-blur-xl sm:bottom-24 sm:right-6"
      aria-label={`${zone.name} details`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 rounded-sm p-1 text-city-muted hover:text-city-foreground"
        aria-label="Close location details"
      >
        <X className="size-4" />
      </button>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-city-muted">
        Location intelligence
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${zone.risk === "HIGH" ? "bg-risk-high" : zone.risk === "MEDIUM" ? "bg-risk-medium" : "bg-risk-low"}`}
        />
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em]">
          {zone.risk} risk
        </span>
      </div>
      <h2 className="mt-3 text-2xl font-semibold">{zone.name}</h2>
      <p className="mt-1 text-sm text-city-muted">{zone.issue}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-city-line py-4">
        <div>
          <dt className="text-xs text-city-muted">Citizen reports</dt>
          <dd className="mt-1 text-xl font-semibold">{zone.reportCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-city-muted">Unresolved</dt>
          <dd className="mt-1 text-xl font-semibold">{zone.unresolvedCount}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-city-muted">
        {zone.lastReported
          ? `Last reported ${new Date(zone.lastReported).toLocaleDateString()}`
          : zone.source === "demonstration"
            ? "Demonstration location"
            : "Recently reported"}
      </p>
      <div className="mt-5 flex gap-2">
        <Button
          asChild
          variant="outline"
          className="flex-1 border-city-line bg-city-panel text-city-foreground hover:bg-city-surface hover:text-city-foreground"
        >
          <Link to="/map">View reports</Link>
        </Button>
        <Button asChild className="flex-1 bg-city-cyan text-city hover:bg-city-cyan-bright">
          <Link to="/report">Report issue</Link>
        </Button>
      </div>
    </motion.aside>
  );
}

export default function CityExperience({
  data,
  onEnter,
  standalone = false,
}: {
  data: CityData;
  onEnter?: () => void;
  standalone?: boolean;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [palette, setPalette] = useState<CityPalette | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [ready, setReady] = useState(reducedMotion);
  const [selectedZone, setSelectedZone] = useState<CityZone | null>(null);
  const [hoveredZone, setHoveredZone] = useState<CityZone | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);
  const [showLayers, setShowLayers] = useState(false);
  const [layers, setLayers] = useState<CityLayers>({ buildings: true, drainage: true, risk: true });
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    setWebgl(supportsWebGL());
    setPalette(readPalette());
    if (reducedMotion) return;
    const timer = window.setInterval(
      () => setLoadingStep((step) => Math.min(step + 1, LOADING_MESSAGES.length - 1)),
      380,
    );
    const done = window.setTimeout(() => setReady(true), 1550);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(done);
    };
  }, [reducedMotion]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      document.body.style.cursor = "default";
    };
  }, []);

  useEffect(() => {
    if (standalone || !onEnter) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY <= 0) return;
      setScrollDistance((distance) => {
        const next = distance + event.deltaY;
        if (next > 700) onEnter();
        return next;
      });
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [onEnter, standalone]);

  const dataLabel = useMemo(
    () => (data.source === "live" ? "Live public report layer" : "Demonstration city layer"),
    [data.source],
  );

  const enterFromCityRoute = () => {
    try {
      window.localStorage.setItem("hasSeenCityIntro", "true");
    } catch {
      // Navigation remains available without local storage.
    }
  };

  if (webgl === false) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-city px-6 text-center text-city-foreground">
        <LocateFixed className="size-10 text-city-cyan" />
        <h1 className="mt-5 text-3xl font-semibold">Urban Drainage Monitor</h1>
        <p className="mt-3 max-w-md text-sm text-city-muted">
          The interactive city needs WebGL, which is unavailable in this browser. The full platform
          remains available.
        </p>
        {onEnter ? (
          <Button onClick={onEnter} className="mt-6 bg-city-cyan text-city">
            Enter platform
          </Button>
        ) : (
          <Button asChild className="mt-6 bg-city-cyan text-city">
            <Link to="/" onClick={enterFromCityRoute}>
              Enter platform
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <section
      className="relative h-svh min-h-[34rem] overflow-hidden bg-city text-city-foreground"
      aria-label="Interactive city digital twin"
    >
      {palette && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.025 }}
          animate={{ opacity: ready ? 1 : 0.18, scale: ready ? 1 : 1.025 }}
          transition={{ duration: reducedMotion ? 0 : 1.15 }}
        >
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [18, 16, 22], fov: 43, near: 0.1, far: 120 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
          >
            <CityScene
              zones={data.zones}
              layers={layers}
              palette={palette}
              selectedZone={selectedZone}
              focusNonce={focusNonce}
              resetNonce={resetNonce}
              reducedMotion={reducedMotion}
              onHover={setHoveredZone}
              onSelect={(zone) => {
                setSelectedZone(zone);
                setFocusNonce((value) => value + 1);
              }}
            />
          </Canvas>
        </motion.div>
      )}

      <AnimatePresence>
        {!ready && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-city"
          >
            <div className="w-[min(26rem,calc(100%-3rem))]">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center border border-city-line bg-city-panel font-display text-xs font-bold text-city-cyan">
                  UD
                </span>
                <span className="text-sm font-semibold">Urban Drainage Monitor</span>
              </div>
              <p className="mt-10 font-mono text-xs uppercase tracking-[0.18em] text-city-cyan">
                {LOADING_MESSAGES[loadingStep]}
              </p>
              <div className="mt-3 h-px overflow-hidden bg-city-line">
                <motion.div
                  className="h-full bg-city-cyan"
                  animate={{ width: `${((loadingStep + 1) / LOADING_MESSAGES.length) * 100}%` }}
                />
              </div>
              {onEnter && (
                <button
                  type="button"
                  onClick={onEnter}
                  className="mt-8 inline-flex items-center gap-2 text-xs text-city-muted hover:text-city-foreground"
                >
                  Skip intro <SkipForward className="size-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 z-10 bg-city-scan" />
      <div className="pointer-events-none absolute inset-0 z-20">
        <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center border border-city-line bg-city-panel/80 font-display text-xs font-bold text-city-cyan backdrop-blur">
                UD
              </span>
              <div>
                <p className="text-sm font-semibold sm:text-base">Urban Drainage Monitor</p>
                <p className="hidden text-xs text-city-muted sm:block">
                  Cleaner cities. Safer communities.
                </p>
              </div>
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-city-muted">
              {dataLabel}
            </p>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setResetNonce((value) => value + 1)}
              className="border-city-line bg-city-panel/80 text-city-foreground backdrop-blur hover:bg-city-surface hover:text-city-foreground"
              title="Reset view"
            >
              <RotateCcw />
            </Button>
            <div className="relative">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setShowLayers((value) => !value)}
                aria-expanded={showLayers}
                className="border-city-line bg-city-panel/80 text-city-foreground backdrop-blur hover:bg-city-surface hover:text-city-foreground"
                title="City layers"
              >
                <Layers3 />
              </Button>
              {showLayers && (
                <div className="absolute right-0 mt-2 w-44 border border-city-line bg-city-panel/95 p-3 text-xs shadow-city backdrop-blur-xl">
                  {Object.entries(layers).map(([key, value]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-3 py-1.5 capitalize"
                    >
                      <span>{key}</span>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() =>
                          setLayers((current) => ({
                            ...current,
                            [key]: !current[key as keyof CityLayers],
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            {standalone ? (
              <Button asChild className="bg-city-cyan text-city hover:bg-city-cyan-bright">
                <Link to="/" onClick={enterFromCityRoute}>
                  Enter platform
                </Link>
              </Button>
            ) : (
              <Button
                onClick={onEnter}
                className="bg-city-cyan text-city hover:bg-city-cyan-bright"
              >
                <span className="hidden sm:inline">Enter platform</span>
                <ChevronDown className="size-4 sm:hidden" />
              </Button>
            )}
          </div>
        </header>

        {hoveredZone && !selectedZone && (
          <div className="absolute bottom-24 left-4 max-w-64 border border-city-line bg-city-panel/90 p-4 text-sm shadow-city backdrop-blur sm:bottom-20 sm:left-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-city-muted">
              {hoveredZone.risk} risk
            </p>
            <p className="mt-2 font-semibold">{hoveredZone.name}</p>
            <p className="mt-1 text-xs text-city-muted">
              {hoveredZone.issue} · {hoveredZone.reportCount} reports
            </p>
            <p className="mt-3 text-xs text-city-cyan">Click to inspect</p>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 w-[calc(100%-2rem)] -translate-x-1/2 text-center sm:bottom-6">
          {!standalone && (
            <button
              type="button"
              onClick={onEnter}
              className="pointer-events-auto mb-3 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-city-foreground hover:text-city-cyan"
            >
              Explore the city · Enter platform <ChevronDown className="size-4 animate-bounce" />
            </button>
          )}
          <div className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-x-3 gap-y-1 border border-city-line bg-city-panel/75 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-city-muted backdrop-blur sm:text-[10px]">
            <span>Drag to rotate</span>
            <span>Scroll to zoom</span>
            <span>Click to inspect</span>
            <span className="hidden sm:inline">● High</span>
            <span className="hidden sm:inline">● Medium</span>
            <span className="hidden sm:inline">● Low</span>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 z-30 pointer-events-none">
        <AnimatePresence>
          {selectedZone && <ZonePanel zone={selectedZone} onClose={() => setSelectedZone(null)} />}
        </AnimatePresence>
      </div>
    </section>
  );
}
