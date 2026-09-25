import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import type { CityData } from "./types";

const CityExperience = lazy(() => import("./CityExperience"));

type Props = {
  data: CityData;
  onEnter?: () => void;
  standalone?: boolean;
};

export function CityLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-city text-city-foreground">
      <div className="text-center">
        <span className="mx-auto block size-2 animate-pulse rounded-full bg-city-cyan" />
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.22em] text-city-muted">
          Preparing city model
        </p>
      </div>
    </div>
  );
}

export function CityExperienceLoader(props: Props) {
  return (
    <ClientOnly fallback={<CityLoading />}>
      <Suspense fallback={<CityLoading />}>
        <CityExperience {...props} />
      </Suspense>
    </ClientOnly>
  );
}
