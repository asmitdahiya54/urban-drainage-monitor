import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, CheckCircle2, Droplets, Map, ShieldCheck } from "lucide-react";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import type { CityData } from "@/components/city/types";

const workflow = [
  {
    icon: Droplets,
    title: "Report",
    text: "Share a drainage issue with its location and severity.",
  },
  {
    icon: Map,
    title: "Monitor",
    text: "See community reports, heat density, and spatial hotspots.",
  },
  {
    icon: BarChart3,
    title: "Respond",
    text: "Track progress as issues move through the civic workflow.",
  },
];

export function PlatformHome({ data }: { data: CityData }) {
  const summary = data.summary;
  const highRiskAreas = data.zones.filter((zone) => zone.risk === "HIGH").length;
  const stats = [
    { label: "Reports", value: summary?.total },
    { label: "In progress", value: undefined },
    { label: "Resolved", value: summary?.resolved },
    { label: "High risk areas", value: data.source === "live" ? highRiskAreas : undefined },
  ];

  return (
    <div className="dark flex min-h-screen flex-col bg-city text-city-foreground">
      <SiteNav />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-city-line bg-city-grid">
          <div className="mx-auto grid min-h-[70svh] max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-city-cyan">
                Community-powered city intelligence
              </p>
              <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
                Cleaner Cities.
                <br />
                <span className="text-city-cyan">Smarter Drainage.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-city-muted sm:text-lg">
                Report drainage issues, monitor urban water risks, and help build safer communities.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/report">
                    Report an issue <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/map">
                    Explore map <Map />
                  </Link>
                </Button>
              </div>
              <Link
                to="/city"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-city-cyan hover:text-city-cyan-bright"
              >
                Return to the 3D city <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="relative min-h-80 border border-city-line bg-city-panel/75 p-6 shadow-city backdrop-blur sm:p-8">
              <div className="absolute right-4 top-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-city-muted">
                <span className="size-1.5 animate-pulse rounded-full bg-risk-low" /> Network online
              </div>
              <p className="font-mono text-xs uppercase tracking-[0.17em] text-city-muted">
                City overview
              </p>
              <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden border border-city-line bg-city-line">
                {stats.map((stat) => (
                  <div key={stat.label} className="bg-city-panel p-5">
                    <dt className="text-xs text-city-muted">{stat.label}</dt>
                    <dd className="mt-2 text-3xl font-semibold">{stat.value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-city-muted">
                {summary
                  ? "Live totals from the privacy-safe public map."
                  : "Live totals will appear when the city data service is available."}
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-city-line bg-city-panel/35">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.17em] text-city-cyan">
                From street to response
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                One connected civic workflow
              </h2>
            </div>
            <div className="mt-9 grid gap-px overflow-hidden border border-city-line bg-city-line md:grid-cols-3">
              {workflow.map(({ icon: Icon, title, text }) => (
                <article key={title} className="bg-city p-7">
                  <Icon className="size-6 text-city-cyan" />
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-city-muted">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.17em] text-city-cyan">
              Built for accountable action
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Community reports become visible infrastructure insight.
            </h2>
            <p className="mt-5 text-city-muted">
              Public mapping, status tracking, spatial analysis, and transparent workflows help
              residents and administrators work from the same picture.
            </p>
          </div>
          <ul className="grid gap-4 text-sm">
            {[
              "Privacy-safe public drainage map",
              "PostGIS hotspot and proximity analysis",
              "Citizen-to-admin status timeline",
              "SDG 6, 11, and 13 alignment",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 border-b border-city-line pb-4">
                <CheckCircle2 className="size-5 text-city-cyan" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-border bg-surface text-surface-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-accent">
                <ShieldCheck className="size-5" />
                <span className="font-mono text-xs uppercase tracking-[0.16em]">
                  Community action
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold">Spotted a blocked drain?</h2>
              <p className="mt-2 text-sm opacity-70">
                Every verified report helps make neighbourhood risk visible.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/report">
                Report an issue <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
