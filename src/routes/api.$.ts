import { createFileRoute } from "@tanstack/react-router";
import { resolveBackendOrigin } from "@/config/backend";

const PUBLIC_FALLBACKS: Record<string, unknown> = {
  "/api/reports/map": {
    reports: [],
    count: 0,
    summary: { total: 0, resolved: 0, high_severity: 0 },
  },
  "/api/reports/hotspots": {
    hotspots: [],
    count: 0,
    params: { radius_m: 400, min_points: 2 },
  },
  "/api/reports/risk-areas": {
    areas: [],
    count: 0,
    model_version: "unavailable",
    disclaimer:
      "Prototype risk prediction based on available crowdsourced report data. Predictions are not official flood warnings.",
  },
};

function publicFallbackFor(request: Request): Response | null {
  if (request.method !== "GET") return null;
  const incomingUrl = new URL(request.url);
  const fallback = PUBLIC_FALLBACKS[incomingUrl.pathname];
  if (!fallback) return null;
  return Response.json(fallback, {
    status: 200,
    headers: { "X-Urban-Drainage-Data": "backend-unavailable" },
  });
}

async function forwardToFlask({ request }: { request: Request }) {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, resolveBackendOrigin());

  try {
    const response = await fetch(new Request(targetUrl, request));
    if (response.status >= 500) {
      // Health is a status report, not a failure: pass Flask's body through
      // with 200 so the UI reads `status`/`database` instead of erroring.
      if (incomingUrl.pathname === "/api/health") {
        return new Response(await response.text(), {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Upstream-Status": String(response.status) },
        });
      }
      const fallback = publicFallbackFor(request);
      if (fallback) return fallback;
    }
    // fetch() already decoded the body, so drop encoding/length headers that
    // would make the browser try to decompress plain JSON again.
    const headers = new Headers(response.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    if (incomingUrl.pathname === "/api/health") {
      return Response.json(
        { status: "unreachable", database: "unknown", message: "Backend service is unavailable" },
        { status: 200 },
      );
    }
    const fallback = publicFallbackFor(request);
    if (fallback) return fallback;
    return Response.json({ error: "Backend service is unavailable" }, { status: 503 });
  }
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: forwardToFlask,
      POST: forwardToFlask,
      PUT: forwardToFlask,
      PATCH: forwardToFlask,
      DELETE: forwardToFlask,
      OPTIONS: forwardToFlask,
    },
  },
});
