import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CityExperienceLoader } from "@/components/city/CityExperienceLoader";
import { DEMONSTRATION_ZONES, loadCityData } from "@/components/city/city-data";
import type { CityData } from "@/components/city/types";

const INITIAL_DATA: CityData = {
  zones: DEMONSTRATION_ZONES,
  summary: null,
  reports: [],
  source: "demonstration",
};

export const Route = createFileRoute("/city")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Interactive 3D City | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Explore an interactive digital twin of urban drainage infrastructure and community risk areas.",
      },
      { property: "og:title", content: "Interactive 3D City | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Explore the Urban Drainage Monitor digital twin and its drainage risk layers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CityPage,
});

function CityPage() {
  const [data, setData] = useState(INITIAL_DATA);
  useEffect(() => {
    let active = true;
    loadCityData().then((next) => {
      if (active) setData(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return <CityExperienceLoader data={data} standalone />;
}
