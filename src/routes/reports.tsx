import { createFileRoute, Link } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ReportList, ReportStats } from "@/components/ReportSummary";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { useMyReports } from "@/hooks/useMyReports";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "My Drainage Reports | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Every drainage issue you have reported, with its current status, severity and location.",
      },
      { property: "og:title", content: "My Drainage Reports | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Track the drainage problems you reported in your neighbourhood.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <MyReportsPage />
    </ProtectedRoute>
  ),
});

function MyReportsPage() {
  const { reports, loading, error } = useMyReports();
  const { isAdmin } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">Reports</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {isAdmin ? "All Drainage Reports" : "My Drainage Reports"}
            </h1>
          </div>
          <Link
            to="/report"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Report an issue
          </Link>
        </div>

        {loading && <p className="mt-8 text-sm text-muted-foreground">Loading your reports…</p>}
        {error && !loading && (
          <p
            role="alert"
            className="mt-8 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <div className="mt-8">
              <ReportStats reports={reports} />
            </div>
            <div className="mt-8">
              <ReportList reports={reports} />
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
