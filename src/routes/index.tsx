import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Urban Drainage Monitor | Community Drainage Reporting" },
      {
        name: "description",
        content:
          "A community-driven platform for reporting, monitoring, and predicting urban drainage problems.",
      },
      { property: "og:title", content: "Urban Drainage Monitor" },
      {
        property: "og:description",
        content:
          "A community-driven platform for reporting, monitoring, and predicting urban drainage problems.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  {
    title: "Report",
    text: "Residents flag blocked drains, waterlogging and overflow points with a location and photo.",
  },
  {
    title: "Monitor",
    text: "An open city map turns scattered complaints into visible drainage hotspots.",
  },
  {
    title: "Predict",
    text: "Historical reports feed a risk model that highlights flood-prone zones before the rains.",
  },
];

const goals = [
  { label: "SDG 6", text: "Clean water and sanitation" },
  { label: "SDG 11", text: "Sustainable cities and communities" },
  { label: "SDG 13", text: "Climate action" },
];

function Index() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="grid-backdrop border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:py-28">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Community civic-tech platform
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
              Urban Drainage <span className="text-primary">Monitor</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              A community-driven platform for reporting, monitoring, and predicting urban drainage
              problems.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/report"
                className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 sm:w-auto"
                style={{ boxShadow: "var(--shadow-raised)" }}
              >
                Report an Issue
              </Link>
              <Link
                to="/map"
                className="w-full rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary sm:w-auto"
              >
                View Drainage Map
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {features.map((f, i) => (
              <article
                key={f.title}
                className="rounded-xl border border-border bg-card p-6"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 font-display text-sm font-bold text-primary">
                  0{i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* SDG band */}
        <section className="bg-surface text-surface-foreground">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-xl font-bold sm:text-2xl">Aligned with the UN SDGs</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {goals.map((g) => (
                <div key={g.label} className="rounded-xl border border-white/10 p-5">
                  <p className="font-display text-sm font-bold text-accent">{g.label}</p>
                  <p className="mt-1 text-sm opacity-80">{g.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:py-20">
          <h2 className="text-2xl font-bold sm:text-3xl">Spotted a blocked drain?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Every report helps the city respond faster and keeps your neighbourhood safer.
          </p>
          <Link
            to="/report"
            className="mt-7 inline-block rounded-lg bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Report an Issue
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
