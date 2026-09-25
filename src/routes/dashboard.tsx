import { createFileRoute, Link } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ReportList, ReportStats } from "@/components/ReportSummary";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/context/AuthContext";
import { useMyReports } from "@/hooks/useMyReports";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Your resident dashboard on Urban Drainage Monitor: report statistics and every drainage issue you have submitted.",
      },
      { property: "og:title", content: "My Dashboard | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Signed-in area for residents of the Urban Drainage Monitor community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  ),
});

function DashboardPage() {
  const { user } = useAuth();
  const { reports, loading, error } = useMyReports();
  const recent = reports.slice(0, 5);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Welcome, {user?.name}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Signed in as {user?.email} ({user?.role}).
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/report"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Report an issue
          </Link>
          <Link
            to="/reports"
            className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            My reports
          </Link>
        </div>

        <h2 className="mt-12 text-lg font-semibold">My Drainage Reports</h2>
        {loading && <p className="mt-4 text-sm text-muted-foreground">Loading your reports…</p>}
        {error && !loading && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <div className="mt-4">
              <ReportStats reports={reports} />
            </div>
            <div className="mt-8">
              <ReportList reports={recent} />
            </div>
            {reports.length > recent.length && (
              <Link
                to="/reports"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                View all {reports.length} reports →
              </Link>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
