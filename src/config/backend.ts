/**
 * Where the same-origin `/api/*` proxy forwards requests.
 *
 * The browser always talks to `/api` on its own origin (see VITE_API_URL), and
 * the server route `src/routes/api.$.ts` forwards those calls to the Flask API.
 *
 * Production (Render): set the `BACKEND_URL` environment variable, or paste the
 * Render service URL into PRODUCTION_BACKEND_ORIGIN below, e.g.
 *   export const PRODUCTION_BACKEND_ORIGIN = "https://urban-drainage-api.onrender.com";
 *
 * Local development: set BACKEND_URL=http://127.0.0.1:5000 to use a local Flask
 * server instead (clear PRODUCTION_BACKEND_ORIGIN to make local the default).
 */
export const PRODUCTION_BACKEND_ORIGIN = "";
export const LOCAL_BACKEND_ORIGIN = "http://127.0.0.1:8765";
/** Resolve the Flask origin the proxy should target (server-side only). */
export function resolveBackendOrigin(): string {
  const fromEnv = typeof process !== "undefined" ? process.env?.["BACKEND_URL"] : undefined;
  const origin = (fromEnv ?? PRODUCTION_BACKEND_ORIGIN).trim();
  return origin.length > 0 ? origin.replace(/\/+$/, "") : LOCAL_BACKEND_ORIGIN;
}
