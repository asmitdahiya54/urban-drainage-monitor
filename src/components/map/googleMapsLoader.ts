/// <reference types="google.maps" />
/**
 * Lazy, single-shot loader for the Google Maps JavaScript API.
 *
 * The browser key is read from import.meta.env — it is never hardcoded and is
 * never printed anywhere (UI, logs or errors). The script tag is only injected
 * the first time a Google map is actually rendered, so other pages never pay
 * for it.
 */

/** Browser-restricted key. Supports the project variable first. */
export const googleMapsApiKey: string =
  (import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] as string | undefined) ??
  (import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined) ??
  "";

export const hasGoogleMapsKey = googleMapsApiKey.trim().length > 0;

export class GoogleMapsError extends Error {
  constructor(
    message: string,
    readonly kind: "missing-key" | "auth" | "network",
  ) {
    super(message);
    this.name = "GoogleMapsError";
  }
}

const CALLBACK = "__udmGoogleMapsReady";

let loadPromise: Promise<typeof google.maps> | null = null;
const authListeners = new Set<() => void>();

/** Google calls this global when the key is rejected (invalid key, API not
 * enabled, billing off, referrer not allowed). It fires after load, so it is
 * surfaced through a subscription rather than the load promise. */
export function onGoogleMapsAuthFailure(listener: () => void): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") {
    return Promise.reject(new GoogleMapsError("Google Maps needs a browser.", "network"));
  }
  if (!hasGoogleMapsKey) {
    return Promise.reject(
      new GoogleMapsError(
        "Google Maps API key is not configured (VITE_GOOGLE_MAPS_API_KEY).",
        "missing-key",
      ),
    );
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<typeof google.maps>((resolve, reject) => {
    const win = window as unknown as Record<string, unknown>;

    win["gm_authFailure"] = () => {
      authListeners.forEach((listener) => listener());
    };

    win[CALLBACK] = () => {
      delete win[CALLBACK];
      resolve(google.maps);
    };

    const params = new URLSearchParams({
      key: googleMapsApiKey,
      libraries: "visualization",
      loading: "async",
      callback: CALLBACK,
      v: "weekly",
    });
    const trackingId = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as
      string | undefined;
    if (trackingId) params.set("channel", trackingId);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(
        new GoogleMapsError(
          "The Google Maps script could not be downloaded. Check the network connection.",
          "network",
        ),
      );
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
