/**
 * Click-to-pin location picker used by the report form.
 *
 * Keeps all map behaviour out of the page: the page only receives latitude /
 * longitude changes. Also offers browser geolocation, and stays fully usable
 * (manual map clicks) when the user denies the permission.
 */
import { useState } from "react";

import { LazyMap } from "./LazyMap";

export type LocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
  disabled?: boolean;
};

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  disabled = false,
}: LocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function useMyLocation() {
    setNotice(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNotice("This browser cannot share your location. Tap the map to place the pin instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange(
          Number(position.coords.latitude.toFixed(6)),
          Number(position.coords.longitude.toFixed(6)),
        );
      },
      (error) => {
        setLocating(false);
        setNotice(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Tap the map to place the pin manually."
            : "Your location could not be determined. Tap the map to place the pin manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Tap or click the map to place the pin on the problem spot.
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={disabled || locating}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
        >
          {locating ? "Finding you…" : "Use my current location"}
        </button>
      </div>

      <div className="h-64 w-full overflow-hidden rounded-xl border border-border sm:h-80">
        <LazyMap
          latitude={latitude}
          longitude={longitude}
          onPick={(lat, lng) => onChange(Number(lat.toFixed(6)), Number(lng.toFixed(6)))}
          label="Loading map…"
        />
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
