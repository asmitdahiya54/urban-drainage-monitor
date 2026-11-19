import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { CityExperienceLoader, CityLoading } from "@/components/city/CityExperienceLoader";
import { DEMONSTRATION_ZONES, loadCityData } from "@/components/city/city-data";
import type { CityData } from "@/components/city/types";
import { PlatformHome } from "@/components/home/PlatformHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Urban Drainage Monitor | Community Drainage Reporting" },
      {
        name: "description",
        content:
          "Explore a digital city, report drainage issues, monitor urban water risks, and help build safer communities.",
      },
      { property: "og:title", content: "Urban Drainage Monitor" },
      {
        property: "og:description",
        content:
          "Explore a digital city, report drainage issues, monitor urban water risks, and help build safer communities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const INTRO_STORAGE_KEY = "hasSeenCityIntro";
const INITIAL_CITY_DATA: CityData = {
  zones: DEMONSTRATION_ZONES,
  summary: null,
  reports: [],
  source: "demonstration",
};

function Index() {
  const reducedMotion = Boolean(useReducedMotion());
  const [mode, setMode] = useState<"checking" | "city" | "transition" | "platform">("checking");
  const [cityData, setCityData] = useState<CityData>(INITIAL_CITY_DATA);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(INTRO_STORAGE_KEY) === "true";
    } catch {
      // Storage can be unavailable in private browsing; show the entry safely.
    }
    setMode(seen ? "platform" : "city");
    let active = true;
    loadCityData().then((data) => {
      if (active) setCityData(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const enterPlatform = useCallback(() => {
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "true");
    } catch {
      // The current session can still continue when storage is unavailable.
    }
    if (reducedMotion) {
      setMode("platform");
      return;
    }
    setMode("transition");
    window.setTimeout(() => setMode("platform"), 950);
  }, [reducedMotion]);

  if (mode === "checking") {
    return <CityLoading />;
  }

  return (
    <AnimatePresence mode="wait">
      {mode === "city" || mode === "transition" ? (
        <motion.div
          key="city"
          initial={{ opacity: 0 }}
          animate={{
            opacity: mode === "transition" ? 0 : 1,
            scale: mode === "transition" ? 1.1 : 1,
            filter: mode === "transition" ? "blur(12px)" : "blur(0px)",
          }}
          transition={{ duration: mode === "transition" ? 0.9 : 0.35, ease: "easeInOut" }}
        >
          <CityExperienceLoader data={cityData} onEnter={enterPlatform} />
        </motion.div>
      ) : (
        <motion.div
          key="platform"
          initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.6 }}
        >
          <PlatformHome data={cityData} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
