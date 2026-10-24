/**
 * Browser-only wrapper around MapCanvas.
 *
 * <ClientOnly> skips server rendering and React.lazy keeps Leaflet out of the
 * server bundle, so the map is imported only once the page is hydrated.
 */
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import type { MapCanvasProps } from "./MapCanvas";

const MapCanvas = lazy(() => import("./MapCanvas"));

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function LazyMap({ label = "Loading map…", ...props }: MapCanvasProps & { label?: string }) {
  return (
    <ClientOnly fallback={<Placeholder label={label} />}>
      <Suspense fallback={<Placeholder label={label} />}>
        <MapCanvas {...props} />
      </Suspense>
    </ClientOnly>
  );
}
