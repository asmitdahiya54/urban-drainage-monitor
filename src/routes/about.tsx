import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "How Urban Drainage Monitor turns citizen drainage reports into visible, accountable city action.",
      },
      { property: "og:title", content: "About Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Community drainage reporting, GIS mapping and prototype risk insight for safer cities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const points = [
  ["Report", "Residents pin blocked drains, waterlogging and overflows with a location and severity."],
  ["Map", "A privacy-safe public map shows reports, hotspots and heat density."],
  ["Respond", "Municipal staff verify, assign and resolve issues through a tracked status workflow."],
  ["Anticipate", "A prototype model highlights areas with rising risk signals. It is not an official flood warning."],
];

function About() {
  return (
    <div className="dark flex min-h-screen flex-col bg-dash text-city-foreground">
      <SiteNav variant="dashboard" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-16">
        <p className="dash-label text-city-cyan">About the platform</p>
        <h1 className="mt-3 text-4xl font-bold">Cleaner drains, safer communities</h1>
        <p className="mt-4 max-w-2xl text-city-muted">
          Urban Drainage Monitor is a community-powered platform aligned with SDG 6 (clean water and
          sanitation), SDG 11 (sustainable cities) and SDG 13 (climate action).
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {points.map(([title, text]) => (
            <div key={title} className="dash-panel">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-city-muted">{text}</p>
            </div>
          ))}
        </div>
        <Link to="/report" className="dash-btn-primary mt-10">
          Report an Issue
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
