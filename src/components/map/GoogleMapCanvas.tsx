/// <reference types="google.maps" />
/**
 * Google Maps basemap for the drainage map.
 *
 * It renders the SAME backend data as the Leaflet canvas (report markers,
 * PostGIS hotspot circles, prototype risk areas and the density heat layer) —
 * there is no second data source. The API script is loaded lazily on mount.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import {
  GoogleMapsError,
  hasGoogleMapsKey,
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
} from "./googleMapsLoader";
import type { HeatPoint, MapHotspot, MapMarker, MapRiskArea } from "./MapCanvas";

export type GoogleMapCanvasProps = {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  heatPoints?: HeatPoint[];
  showHeat?: boolean;
  hotspots?: MapHotspot[];
  riskAreas?: MapRiskArea[];
  onSelectMarker?: (id: number) => void;
};

const TONE_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#dc2626",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#dc2626",
};

const MAP_TYPES = [
  { value: "roadmap", label: "Map" },
  { value: "satellite", label: "Satellite" },
  { value: "hybrid", label: "Hybrid" },
  { value: "terrain", label: "Terrain" },
] as const;

type MapTypeValue = (typeof MAP_TYPES)[number]["value"];

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

function panelButton(active = false) {
  return [
    "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
    active
      ? "bg-[#0ea5e9] text-white"
      : "bg-white/85 text-slate-800 hover:bg-white dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-900",
  ].join(" ");
}

export default function GoogleMapCanvas({
  center,
  zoom = 12,
  markers = [],
  heatPoints = [],
  showHeat = false,
  hotspots = [],
  riskAreas = [],
  onSelectMarker,
}: GoogleMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const overlaysRef = useRef<Array<{ setMap(map: google.maps.Map | null): void }>>([]);
  const meMarkerRef = useRef<google.maps.Marker | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mapType, setMapType] = useState<MapTypeValue>("roadmap");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const initialCenter = useMemo(() => ({ lat: center[0], lng: center[1] }), [center]);

  // --- load the API and create the map (once) ---
  useEffect(() => {
    let cancelled = false;
    const stopAuthWatch = onGoogleMapsAuthFailure(() => {
      if (cancelled) return;
      setStatus("error");
      setErrorMessage(
        "Google Maps rejected this site's API key. In Google Cloud, confirm the Maps JavaScript API is enabled, billing is active, and this domain is in the key's allowed referrers.",
      );
    });

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: initialCenter,
          zoom,
          mapTypeId: "roadmap",
          clickableIcons: false,
          mapTypeControl: false,
          fullscreenControl: true,
          streetViewControl: false,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        mapRef.current = map;
        infoRef.current = new maps.InfoWindow();
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(
          err instanceof GoogleMapsError && err.kind === "missing-key"
            ? "Google Maps is not configured yet. Add VITE_GOOGLE_MAPS_API_KEY to the frontend environment to enable the Google basemap."
            : "Google Maps is currently unavailable. Please check the Maps API configuration.",
        );
      });

    return () => {
      cancelled = true;
      stopAuthWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- keep the map type in sync ---
  useEffect(() => {
    if (status === "ready") mapRef.current?.setMapTypeId(mapType);
  }, [mapType, status]);

  // --- draw report markers, hotspots, risk areas and the heat layer ---
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || typeof google === "undefined") return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    hotspots.forEach((hotspot) => {
      const circle = new google.maps.Circle({
        map,
        center: { lat: hotspot.latitude, lng: hotspot.longitude },
        radius: Math.max(hotspot.radiusM, 150),
        strokeColor: "#dc2626",
        strokeOpacity: 0.9,
        strokeWeight: 1.5,
        fillColor: "#dc2626",
        fillOpacity: 0.12,
        clickable: true,
      });
      circle.addListener("click", () => {
        infoRef.current?.setContent(
          `<div style="font:500 13px/1.4 system-ui;color:#0f172a"><strong>Hotspot</strong><br/>${hotspot.reportCount} reports nearby${
            hotspot.label ? `<br/>${escapeHtml(hotspot.label)}` : ""
          }</div>`,
        );
        infoRef.current?.setPosition({ lat: hotspot.latitude, lng: hotspot.longitude });
        infoRef.current?.open({ map });
      });
      overlaysRef.current.push(circle);
    });

    riskAreas.forEach((area) => {
      const color = RISK_COLORS[area.level] ?? "#22c55e";
      const circle = new google.maps.Circle({
        map,
        center: { lat: area.latitude, lng: area.longitude },
        radius: 300 + area.score * 500,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 1.5,
        fillColor: color,
        fillOpacity: 0.18,
        clickable: true,
      });
      circle.addListener("click", () => {
        infoRef.current?.setContent(
          `<div style="font:500 13px/1.4 system-ui;color:#0f172a"><strong>${area.level} predicted risk</strong><br/>Risk score ${area.score.toFixed(
            2,
          )}<br/><em>Prototype prediction — not an official flood warning.</em></div>`,
        );
        infoRef.current?.setPosition({ lat: area.latitude, lng: area.longitude });
        infoRef.current?.open({ map });
      });
      overlaysRef.current.push(circle);
    });

    if (showHeat && heatPoints.length > 0) {
      // The published typings omit the options constructor / setMap on
      // HeatmapLayer, so it is created through a narrow local shape.
      const HeatmapCtor = google.maps.visualization.HeatmapLayer as unknown as new (
        options: Record<string, unknown>,
      ) => { setMap(map: google.maps.Map | null): void };
      const heat = new HeatmapCtor({
        map,
        radius: 32,
        data: heatPoints.map(([lat, lng, weight]) => ({
          location: new google.maps.LatLng(lat, lng),
          weight,
        })),
      });
      overlaysRef.current.push(heat);
    }

    markers.forEach((marker) => {
      const color = TONE_COLORS[marker.tone ?? ""] ?? "#0ea5e9";
      const pin = new google.maps.Marker({
        map,
        position: { lat: marker.latitude, lng: marker.longitude },
        title: marker.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      pin.addListener("click", () => {
        const lines = marker.lines.map((line) => escapeHtml(line)).join("<br/>");
        const button = onSelectMarker
          ? `<button type="button" id="udm-marker-action" style="margin-top:8px;font-weight:600;text-decoration:underline;cursor:pointer;background:none;border:0;padding:0;color:#0369a1">View details</button>`
          : "";
        infoRef.current?.setContent(
          `<div style="font:400 13px/1.5 system-ui;color:#0f172a;min-width:170px">
             <span style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#0369a1">Drainage issue</span>
             <div style="font-weight:700;margin-top:2px">${escapeHtml(marker.title)}</div>
             <div style="margin-top:4px">${lines}</div>
             <div style="margin-top:4px;color:#475569">Location: ${marker.latitude.toFixed(
               4,
             )}, ${marker.longitude.toFixed(4)}</div>
             ${button}
           </div>`,
        );
        infoRef.current?.open({ map, anchor: pin });
        if (onSelectMarker) {
          google.maps.event.addListenerOnce(infoRef.current!, "domready", () => {
            document
              .getElementById("udm-marker-action")
              ?.addEventListener("click", () => onSelectMarker(marker.id));
          });
        }
      });
      overlaysRef.current.push(pin);
    });
  }, [status, markers, hotspots, riskAreas, heatPoints, showHeat, onSelectMarker]);

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    infoRef.current?.close();
    map.setCenter(initialCenter);
    map.setZoom(zoom);
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setNotice("This browser cannot share a location.");
      return;
    }
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const map = mapRef.current;
        if (!map || typeof google === "undefined") return;
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        meMarkerRef.current?.setMap(null);
        meMarkerRef.current = new google.maps.Marker({
          map,
          position: point,
          title: "Your location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#0ea5e9",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        map.setCenter(point);
        map.setZoom(15);
      },
      () => setNotice("Location permission was not granted."),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const match = search.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      setNotice("Enter coordinates as latitude, longitude (for example 28.6139, 77.2090).");
      return;
    }
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setNotice("Those coordinates are out of range.");
      return;
    }
    setNotice(null);
    mapRef.current?.setCenter({ lat, lng });
    mapRef.current?.setZoom(15);
  };

  if (status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-secondary px-6 py-8 text-center">
        <p className="text-sm font-semibold">Google Maps is currently unavailable.</p>
        <p className="max-w-md text-sm text-muted-foreground">{errorMessage}</p>
        <p className="text-xs text-muted-foreground">
          Switch to the Leaflet GIS basemap above to keep using the map meanwhile.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary text-sm text-muted-foreground">
          {hasGoogleMapsKey ? "Loading Google Maps…" : "Checking Google Maps configuration…"}
        </div>
      )}

      {status === "ready" && (
        <div className="pointer-events-auto absolute left-3 top-3 max-w-[15rem] rounded-xl border border-white/30 bg-slate-900/70 p-2.5 text-white shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap gap-1.5">
            {MAP_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMapType(option.value)}
                className={panelButton(mapType === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <form onSubmit={submitSearch} className="mt-2 flex gap-1.5">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="lat, lng"
              aria-label="Search coordinates"
              className="w-full min-w-0 rounded-md border border-white/20 bg-white/90 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-500"
            />
            <button type="submit" className={panelButton()}>
              Go
            </button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={locateMe} className={panelButton()}>
              My location
            </button>
            <button type="button" onClick={resetView} className={panelButton()}>
              Reset view
            </button>
          </div>
          {notice && <p className="mt-2 text-[11px] leading-snug text-cyan-200">{notice}</p>}
        </div>
      )}
    </div>
  );
}
