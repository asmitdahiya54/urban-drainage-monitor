/**
 * The only module that touches Leaflet directly.
 *
 * It is loaded lazily inside <ClientOnly> (see LazyMap) so Leaflet never runs
 * during server rendering, where `window` does not exist.
 */
import "leaflet/dist/leaflet.css";
import "./pin.css";

import L from "leaflet";
import "leaflet.heat";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect, useMemo } from "react";

/**
 * Leaflet's default marker points at image files by URL, which breaks under a
 * bundler. A small CSS pin avoids that problem entirely.
 */
const pinIcon = L.divIcon({
  className: "udm-pin",
  html: '<span class="udm-pin__dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const toneIcons: Record<string, L.DivIcon> = {};

function iconFor(tone?: string) {
  if (!tone) return pinIcon;
  if (!toneIcons[tone]) {
    toneIcons[tone] = L.divIcon({
      className: `udm-pin udm-pin--${tone}`,
      html: '<span class="udm-pin__dot"></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }
  return toneIcons[tone];
}

/** One pin on a multi-report map (admin overview / public map). */
export type MapMarker = {
  id: number;
  latitude: number;
  longitude: number;
  title: string;
  lines: string[];
  /** Optional severity colour: low | medium | high | critical. */
  tone?: string;
};

/** A PostGIS cluster drawn as a translucent circle. */
export type MapHotspot = {
  id: number | string;
  latitude: number;
  longitude: number;
  radiusM: number;
  reportCount: number;
  label?: string;
};

/** A prototype risk area drawn as a colour-coded circle (Step 9). */
export type MapRiskArea = {
  id: number | string;
  latitude: number;
  longitude: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  reportCount?: number | null;
};

const RISK_COLORS: Record<string, string> = {
  LOW: "#0ea5e9",
  MEDIUM: "#f59e0b",
  HIGH: "#dc2626",
};

/** [latitude, longitude, intensity] triples for the heat layer. */
export type HeatPoint = [number, number, number];

export type MapCanvasProps = {
  latitude: number | null;
  longitude: number | null;
  /** Map centre used until a point is chosen. */
  fallbackCenter?: [number, number];
  zoom?: number;
  /** When provided, clicking the map reports the clicked coordinates. */
  onPick?: (latitude: number, longitude: number) => void;
  /** Extra pins with popups, used by the admin and public maps. */
  markers?: MapMarker[];
  /** Called when the "Open report" button inside a popup is clicked. */
  onSelectMarker?: (id: number) => void;
  /** Density heat layer (leaflet.heat). */
  heatPoints?: HeatPoint[];
  showHeat?: boolean;
  /** PostGIS hotspot clusters drawn as circles. */
  hotspots?: MapHotspot[];
  /** Prototype risk areas (Step 9) — not official flood warnings. */
  riskAreas?: MapRiskArea[];
  className?: string;
};

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function Recenter({ position, zoom }: { position: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), zoom));
  }, [map, position, zoom]);
  return null;
}

/** Heat layer wrapper: created and removed with the layer's lifetime. */
function HeatLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  const serialized = useMemo(() => JSON.stringify(points), [points]);

  useEffect(() => {
    const data = JSON.parse(serialized) as HeatPoint[];
    if (data.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = (L as any).heatLayer(data, {
      radius: 28,
      blur: 20,
      maxZoom: 17,
      max: 4,
      gradient: {
        0.2: "#0ea5e9",
        0.4: "#22c55e",
        0.6: "#f59e0b",
        0.8: "#f97316",
        1.0: "#dc2626",
      },
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, serialized]);

  return null;
}

export default function MapCanvas({
  latitude,
  longitude,
  fallbackCenter = [28.6139, 77.209],
  zoom = 13,
  onPick,
  markers,
  onSelectMarker,
  heatPoints,
  showHeat = false,
  hotspots,
  riskAreas,
  className,
}: MapCanvasProps) {
  const hasPoint = typeof latitude === "number" && typeof longitude === "number";
  const position: [number, number] | null = hasPoint
    ? [latitude as number, longitude as number]
    : null;

  return (
    <MapContainer
      center={position ?? fallbackCenter}
      zoom={position ? Math.max(zoom, 15) : zoom}
      scrollWheelZoom={Boolean(onPick)}
      className={className ?? "h-full w-full"}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {onPick && <ClickHandler onPick={onPick} />}
      <Recenter position={position} zoom={position ? 15 : zoom} />
      {showHeat && heatPoints && heatPoints.length > 0 && <HeatLayer points={heatPoints} />}
      {(hotspots ?? []).map((hotspot) => (
        <Circle
          key={`hotspot-${hotspot.id}`}
          center={[hotspot.latitude, hotspot.longitude]}
          radius={Math.max(hotspot.radiusM, 150)}
          pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.12, weight: 1.5 }}
        >
          <Popup>
            <strong>Hotspot</strong>
            <span style={{ display: "block" }}>{hotspot.reportCount} reports nearby</span>
            {hotspot.label && <span style={{ display: "block" }}>{hotspot.label}</span>}
          </Popup>
        </Circle>
      ))}
      {(riskAreas ?? []).map((area) => (
        <Circle
          key={`risk-${area.id}`}
          center={[area.latitude, area.longitude]}
          radius={300 + area.score * 500}
          pathOptions={{
            color: RISK_COLORS[area.level] ?? RISK_COLORS["LOW"],
            fillColor: RISK_COLORS[area.level] ?? RISK_COLORS["LOW"],
            fillOpacity: 0.18,
            weight: 1.5,
          }}
        >
          <Popup>
            <strong>{area.level} predicted risk</strong>
            <span style={{ display: "block" }}>Risk score {area.score.toFixed(2)}</span>
            {typeof area.reportCount === "number" && (
              <span style={{ display: "block" }}>{area.reportCount} reports in this area</span>
            )}
            <span style={{ display: "block", marginTop: 4, fontStyle: "italic" }}>
              Prototype prediction — not an official flood warning.
            </span>
          </Popup>
        </Circle>
      ))}
      {position && <Marker position={position} icon={pinIcon} />}
      {(markers ?? []).map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.latitude, marker.longitude]}
          icon={iconFor(marker.tone)}
        >
          <Popup>
            <strong>{marker.title}</strong>
            {marker.lines.map((line) => (
              <span key={line} style={{ display: "block" }}>
                {line}
              </span>
            ))}
            {onSelectMarker && (
              <button
                type="button"
                onClick={() => onSelectMarker(marker.id)}
                style={{ marginTop: 6, fontWeight: 600, textDecoration: "underline" }}
              >
                Open report
              </button>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
