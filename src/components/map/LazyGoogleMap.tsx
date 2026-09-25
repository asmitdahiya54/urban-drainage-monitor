/**
 * Browser-only wrapper around GoogleMapCanvas.
 *
 * Mirrors LazyMap: <ClientOnly> skips server rendering and React.lazy keeps the
 * Google Maps code (and its script loader) out of every other page's bundle.
 */
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import type { GoogleMapCanvasProps } from "./GoogleMapCanvas";

const GoogleMapCanvas = lazy(() => import("./GoogleMapCanvas"));

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function LazyGoogleMap({
  label = "Loading Google Maps…",
  ...props
}: GoogleMapCanvasProps & { label?: string }) {
  return (
    <ClientOnly fallback={<Placeholder label={label} />}>
      <Suspense fallback={<Placeholder label={label} />}>
        <GoogleMapCanvas {...props} />
      </Suspense>
    </ClientOnly>
  );
}
