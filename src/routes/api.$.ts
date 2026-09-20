import { createFileRoute } from "@tanstack/react-router";
import { resolveBackendOrigin } from "@/config/backend";

async function forwardToFlask({ request }: { request: Request }) {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, resolveBackendOrigin());

  try {
    const response = await fetch(new Request(targetUrl, request));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
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
