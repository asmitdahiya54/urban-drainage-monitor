import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { MaintenanceManager } from "@/components/maintenance/MaintenanceManager";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "Drainage Maintenance Tracker | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Track scheduled, ongoing and completed drainage maintenance work across the city.",
      },
      { property: "og:title", content: "Drainage Maintenance Tracker | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "See drainage cleaning, repair and construction work and its progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenancePage,
});

function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <MaintenanceManager />
      </main>
      <SiteFooter />
    </div>
  );
}
