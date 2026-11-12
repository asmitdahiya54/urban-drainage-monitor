/** Small read-only map showing where a report was filed. */
import { LazyMap } from "./LazyMap";

export function StaticLocationMap({
  latitude,
  longitude,
  className = "h-56 w-full overflow-hidden rounded-xl border border-border",
}: {
  latitude: number;
  longitude: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <LazyMap latitude={latitude} longitude={longitude} zoom={16} label="Loading location…" />
    </div>
  );
}
